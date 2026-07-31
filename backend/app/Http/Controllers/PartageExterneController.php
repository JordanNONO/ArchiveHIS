<?php

namespace App\Http\Controllers;

use App\Mail\OtpCodeMail;
use App\Models\DocumentArchive;
use App\Models\Share;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/**
 * Espace de consultation pour les tiers externes (avocats, experts-comptables...)
 * ayant reçu un lien de partage sécurisé : aucune authentification personnel, l'accès
 * est protégé par un code à usage unique envoyé à l'adresse email du partage (voir
 * Share::genererOtp()/verifierOtp()). Ce contrôleur ne connaît que des tokens publics,
 * jamais d'identifiant interne.
 */
class PartageExterneController extends Controller
{
    /**
     * Messages précis par motif d'échec de vérification (voir Share::verifierOtp()),
     * plutôt qu'un "code incorrect ou expiré" générique qui ne dit pas à la personne
     * quoi faire ensuite.
     */
    private function messagePourMotif(string $motif, Share $partage): string
    {
        return match ($motif) {
            'aucun_code' => "Aucun code n'a été demandé. Cliquez sur \"Recevoir le code\" pour en obtenir un.",
            'expire' => 'Ce code a expiré. Demandez-en un nouveau.',
            'trop_de_tentatives' => 'Trop de tentatives incorrectes. Demandez un nouveau code.',
            'incorrect' => $partage->tentativesRestantes() > 0
                ? "Code incorrect. Il vous reste {$partage->tentativesRestantes()} tentative(s)."
                : 'Code incorrect. Demandez un nouveau code.',
            default => 'Code incorrect ou expiré.',
        };
    }

    private function trouverPartageValide(string $token): ?Share
    {
        $partage = Share::where('token', $token)->first();

        if (!$partage || !$partage->lienEstValide()) {
            return null;
        }

        return $partage;
    }

    /**
     * Informations publiques minimales pour afficher la page de consultation avant
     * toute vérification (email masqué, dont on demande confirmation).
     */
    public function infos(string $token)
    {
        $partage = $this->trouverPartageValide($token);

        if (!$partage) {
            return response()->json(['error' => 'Ce lien est invalide ou a expiré.'], 410);
        }

        return response()->json([
            'email_masque' => $partage->emailMasque(),
            'expediteur' => $partage->user?->nom,
            'session_active' => $partage->sessionEstValide(request()->query('session')),
        ], 200);
    }

    /**
     * Envoie (ou renvoie) le code d'accès à l'adresse email du partage.
     */
    public function envoyerCode(string $token)
    {
        $partage = $this->trouverPartageValide($token);

        if (!$partage) {
            return response()->json(['error' => 'Ce lien est invalide ou a expiré.'], 410);
        }

        if (!$partage->peutRedemanderOtp()) {
            return response()->json(['error' => 'Veuillez patienter une minute avant de redemander un code.'], 429);
        }

        $code = $partage->genererOtp();

        Mail::to($partage->email_destinataire)->send(new OtpCodeMail($code, 10));

        return response()->json(['message' => 'Un code a été envoyé à ' . $partage->emailMasque()], 200);
    }

    /**
     * Vérifie le code saisi et ouvre une session de consultation (30 min).
     */
    public function verifierCode(Request $request, string $token)
    {
        $partage = $this->trouverPartageValide($token);

        if (!$partage) {
            return response()->json(['error' => 'Ce lien est invalide ou a expiré.'], 410);
        }

        $validated = $request->validate(['code' => 'required|string']);

        $motifEchec = $partage->verifierOtp($validated['code']);
        if ($motifEchec !== null) {
            return response()->json(['error' => $this->messagePourMotif($motifEchec, $partage)], 422);
        }

        return response()->json([
            'session_token' => $partage->session_token,
            'expire_le' => $partage->session_expire_le,
        ], 200);
    }

    /**
     * Métadonnées du document partagé, une fois la session ouverte.
     */
    public function document(Request $request, string $token)
    {
        $partage = $this->trouverPartageValide($token);

        if (!$partage || !$partage->sessionEstValide($request->query('session'))) {
            return response()->json(['error' => 'Session invalide ou expirée. Redemandez un code.'], 401);
        }

        if (!$partage->shareable instanceof DocumentArchive) {
            return response()->json(['error' => 'Ce partage ne concerne pas un document consultable ici.'], 422);
        }

        $document = $partage->shareable;

        return response()->json([
            'titre_document' => $document->titre_document,
            'code_reference' => $document->code_reference,
            'taille' => $document->taille,
            'extension' => pathinfo($document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
        ], 200);
    }

    /**
     * Télécharge le fichier — lien direct (pas d'en-tête personnalisé possible), le
     * jeton de session est donc passé en query string.
     */
    public function telecharger(Request $request, string $token)
    {
        $partage = $this->trouverPartageValide($token);

        if (!$partage || !$partage->sessionEstValide($request->query('session'))) {
            return response()->json(['error' => 'Session invalide ou expirée. Redemandez un code.'], 401);
        }

        if (!$partage->shareable instanceof DocumentArchive) {
            return response()->json(['error' => 'Ce partage ne concerne pas un document consultable ici.'], 422);
        }

        $document = $partage->shareable;
        $partage->update(['dernier_acces_le' => now()]);

        $extension = pathinfo($document->chemin_stockage_serveur, PATHINFO_EXTENSION);
        $nomTelecharge = $document->nom_fichier_original ?: ($document->titre_document . '.' . $extension);

        return response(Storage::disk(config('filesystems.document_disk'))->get($document->chemin_stockage_serveur))
            ->header('Content-Type', $document->format_mime ?? 'application/octet-stream')
            ->header('Content-Disposition', 'attachment; filename="' . $nomTelecharge . '"');
    }
}
