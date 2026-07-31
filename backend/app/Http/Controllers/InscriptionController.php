<?php

namespace App\Http\Controllers;

use App\Mail\OtpCodeMail;
use App\Models\Personnels;
use App\Models\RoleUsers;
use App\Models\UserRole;
use App\Models\Utilisateurs;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Auto-inscription des comptes "dépôt" (intervenants de terrain, bénéficiaires) :
 * contrairement au personnel interne (créé par un admin via PersonnelController),
 * ces comptes n'appartiennent à aucun bureau et se créent eux-mêmes leur accès.
 * L'email est vérifié par code à usage unique avant toute création de compte,
 * pour la même raison que le partage externe (voir Share/PartageExterneController) :
 * on ne crée rien tant qu'on n'a pas confirmé que l'adresse appartient bien à la
 * personne qui s'inscrit.
 */
class InscriptionController extends Controller
{
    private const REGEX_TEL_FR = '/^(?:0|\+33\s?)[1-9](?:[\s.-]?\d{2}){4}$/';

    private const ROLES_AUTORISES = ['Intervenant', 'Beneficiaire'];

    private const DUREE_OTP_MINUTES = 10;

    private const MAX_TENTATIVES_OTP = 5;

    private function cleCache(string $email): string
    {
        return 'inscription_en_attente_' . strtolower($email);
    }

    /**
     * Étape 1 : valide le formulaire, ne crée rien encore — envoie un code à
     * l'email fourni et garde les informations en attente (10 min).
     */
    public function envoyerCode(Request $request)
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'telephone' => ['required', 'string', 'regex:' . self::REGEX_TEL_FR],
            'email' => 'required|string|email|unique:utilisateurs,mail',
            'password' => 'required|string|min:8',
            'type' => ['required', Rule::in(self::ROLES_AUTORISES)],
            // Choix du canal d'envoi du code : seul l'email est réellement câblé pour
            // l'instant (pas de fournisseur SMS branché) — voir canauxDisponibles().
            'canal' => 'nullable|string|in:email,sms',
        ]);

        if (($validated['canal'] ?? 'email') !== 'email') {
            return response()->json(['error' => "L'envoi par SMS n'est pas encore disponible, choisissez l'email pour recevoir votre code."], 422);
        }

        $code = (string) random_int(100000, 999999);

        Cache::put($this->cleCache($validated['email']), [
            'nom' => $validated['nom'],
            'prenom' => $validated['prenom'],
            'telephone' => $validated['telephone'],
            'email' => $validated['email'],
            'password_hash' => Hash::make($validated['password']),
            'type' => $validated['type'],
            'otp_hash' => Hash::make($code),
            'otp_tentatives' => 0,
            'expire_le' => now()->addMinutes(self::DUREE_OTP_MINUTES),
        ], now()->addMinutes(self::DUREE_OTP_MINUTES));

        Mail::to($validated['email'])->send(new OtpCodeMail($code, self::DUREE_OTP_MINUTES));

        return response()->json(['message' => 'Un code a été envoyé à ' . $validated['email']], 200);
    }

    /**
     * Étape 2 : vérifie le code et, seulement à ce moment, crée réellement le compte.
     */
    public function verifierEtCreer(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'code' => 'required|string',
        ]);

        $cle = $this->cleCache($validated['email']);
        $enAttente = Cache::get($cle);

        if (!$enAttente) {
            return response()->json(['error' => "Votre code a expiré. Revenez au formulaire pour en redemander un."], 422);
        }

        if (($enAttente['otp_tentatives'] ?? 0) >= self::MAX_TENTATIVES_OTP) {
            return response()->json(['error' => 'Trop de tentatives incorrectes. Revenez au formulaire pour redemander un code.'], 422);
        }

        if (!Hash::check($validated['code'], $enAttente['otp_hash'])) {
            $enAttente['otp_tentatives'] = ($enAttente['otp_tentatives'] ?? 0) + 1;
            // On repose le compteur mis à jour sans repousser l'expiration d'origine,
            // sinon deviner en boucle prolongerait indéfiniment la fenêtre du code.
            Cache::put($cle, $enAttente, $enAttente['expire_le'] ?? now()->addMinutes(self::DUREE_OTP_MINUTES));

            $restantes = self::MAX_TENTATIVES_OTP - $enAttente['otp_tentatives'];
            $message = $restantes > 0
                ? "Code incorrect. Il vous reste {$restantes} tentative(s)."
                : 'Code incorrect. Demandez un nouveau code.';

            return response()->json(['error' => $message], 422);
        }

        $role = RoleUsers::where('nom', $enAttente['type'])->first();
        if (!$role) {
            return response()->json(['error' => "Ce type de compte n'est pas disponible pour le moment."], 422);
        }

        try {
            $user = DB::transaction(function () use ($enAttente, $role) {
                $user = Utilisateurs::create([
                    'nom' => $enAttente['prenom'] . ' ' . $enAttente['nom'],
                    'mail' => $enAttente['email'],
                    'password' => $enAttente['password_hash'],
                ]);

                UserRole::create([
                    'role_id' => $role->id,
                    'utilisateur_id' => $user->id,
                ]);

                Personnels::create([
                    'utilisateur_id' => $user->id,
                    'nom' => $enAttente['nom'],
                    'prenom' => $enAttente['prenom'],
                    'bureau_id' => null,
                    'first_phone' => $enAttente['telephone'],
                ]);

                return $user;
            });

            Cache::forget($cle);

            $token = JWTAuth::fromUser($user);

            return response()->json([
                'token' => $token,
                'token_type' => 'bearer',
                'message' => 'Compte créé avec succès',
                'expires_in' => JWTAuth::factory()->getTTL() * 60,
            ], 201);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La création du compte a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
