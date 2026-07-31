<?php

namespace App\Http\Controllers;

use App\Mail\OtpCodeMail;
use App\Models\Utilisateurs;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Réinitialisation de mot de passe par code à usage unique — même mécanisme
 * que l'auto-inscription (voir InscriptionController) : universel à tout
 * compte (personnel interne, intervenant, bénéficiaire), puisque Utilisateurs
 * n'est pas partitionné par rôle.
 */
class MotDePasseOublieController extends Controller
{
    private const DUREE_OTP_MINUTES = 10;

    private const MAX_TENTATIVES_OTP = 5;

    private function cleCache(string $email): string
    {
        return 'reinitialisation_mdp_' . strtolower($email);
    }

    /**
     * Étape 1 : envoie un code si un compte existe pour cet email. Répond
     * toujours avec le même message, qu'un compte existe ou non, pour ne pas
     * permettre de deviner quels emails sont enregistrés dans l'application.
     */
    public function envoyerCode(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
        ]);

        $reponse = ['message' => "Si un compte existe pour cette adresse, un code de réinitialisation vient d'être envoyé."];

        $utilisateur = Utilisateurs::where('mail', $validated['email'])->first();
        if (!$utilisateur) {
            return response()->json($reponse, 200);
        }

        $code = (string) random_int(100000, 999999);

        Cache::put($this->cleCache($validated['email']), [
            'utilisateur_id' => $utilisateur->id,
            'otp_hash' => Hash::make($code),
            'otp_tentatives' => 0,
            'expire_le' => now()->addMinutes(self::DUREE_OTP_MINUTES),
        ], now()->addMinutes(self::DUREE_OTP_MINUTES));

        Mail::to($validated['email'])->send(new OtpCodeMail($code, self::DUREE_OTP_MINUTES));

        return response()->json($reponse, 200);
    }

    /**
     * Étape 2 : vérifie le code et, seulement à ce moment, enregistre le
     * nouveau mot de passe.
     */
    public function reinitialiser(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'code' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $cle = $this->cleCache($validated['email']);
        $enAttente = Cache::get($cle);

        if (!$enAttente) {
            return response()->json(['error' => 'Votre code a expiré. Redemandez-en un.'], 422);
        }

        if (($enAttente['otp_tentatives'] ?? 0) >= self::MAX_TENTATIVES_OTP) {
            return response()->json(['error' => 'Trop de tentatives incorrectes. Redemandez un code.'], 422);
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

        $utilisateur = Utilisateurs::find($enAttente['utilisateur_id']);
        if (!$utilisateur) {
            Cache::forget($cle);
            return response()->json(['error' => "Ce compte n'existe plus."], 422);
        }

        $utilisateur->update(['password' => Hash::make($validated['password'])]);
        Cache::forget($cle);

        return response()->json(['message' => 'Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.'], 200);
    }
}
