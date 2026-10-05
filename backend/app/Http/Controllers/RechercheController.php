<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use App\Models\Cheque;
use App\Models\DocumentArchive;
use App\Models\PaiDossier;
use App\Models\Personnels;
use App\Services\VisibiliteDocumentService;
use Illuminate\Http\Request;

/**
 * Recherche globale (Ctrl/Cmd+K, voir RechercheGlobale.jsx) — jusqu'ici
 * limitée aux PAGES de l'appli (fonctionnalitesApp.js, toujours gérées côté
 * client). Ce contrôleur ajoute la recherche dans les VRAIES données :
 * personnel, documents, courriers, appels, chèques, PAI — pour que taper un
 * nom ou une référence amène directement à la bonne fiche, pas seulement à
 * la bonne page. Mêmes règles de permission/visibilité que les pages
 * d'origine (index() de chaque registre), jamais plus permissif.
 */
class RechercheController extends Controller
{
    private const LIMITE = 5;

    public function globale(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([
                'personnes' => [],
                'documents' => [],
                'courriers' => [],
                'appels' => [],
                'cheques' => [],
                'pai' => [],
            ], 200);
        }

        $user = auth('api')->user();
        $like = '%' . $q . '%';

        $personnes = Personnels::with('bureau')
            ->where(function ($query) use ($like) {
                $query->where('nom', 'like', $like)
                    ->orWhere('prenom', 'like', $like)
                    ->orWhereRaw("CONCAT(prenom, ' ', nom) LIKE ?", [$like])
                    ->orWhereRaw("CONCAT(nom, ' ', prenom) LIKE ?", [$like]);
            })
            ->limit(self::LIMITE)
            ->get()
            ->map(fn (Personnels $p) => [
                'id' => $p->id,
                'titre' => trim("{$p->prenom} {$p->nom}"),
                'sousTitre' => $p->bureau?->nom,
            ]);

        $documentsQuery = DocumentArchive::whereNull('sens_courrier')
            ->where(function ($query) use ($like) {
                $query->where('titre_document', 'like', $like)
                    ->orWhere('code_reference', 'like', $like);
            });
        (new VisibiliteDocumentService())->restreindre($documentsQuery, $user);
        $documents = $documentsQuery->orderBy('titre_document')->limit(self::LIMITE)->get()
            ->map(fn (DocumentArchive $d) => [
                'id' => $d->id,
                'titre' => $d->titre_document,
                'sousTitre' => $d->code_reference,
                'lien' => "/view/{$d->id}/" . pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
            ]);

        $courriersQuery = DocumentArchive::whereNotNull('sens_courrier')
            ->where(function ($query) use ($like) {
                $query->where('titre_document', 'like', $like)
                    ->orWhere('objet', 'like', $like)
                    ->orWhere('expediteur_nom', 'like', $like)
                    ->orWhere('destinataire_nom', 'like', $like);
            });
        (new VisibiliteDocumentService())->restreindre($courriersQuery, $user);
        $courriers = $courriersQuery->orderByDesc('created_at')->limit(self::LIMITE)->get()
            ->map(fn (DocumentArchive $d) => [
                'id' => $d->id,
                'titre' => $d->titre_document ?: $d->objet,
                'sousTitre' => $d->sens_courrier === 'entrant' ? $d->expediteur_nom : $d->destinataire_nom,
                'lien' => "/view/{$d->id}/" . pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
            ]);

        $appels = collect();
        if ($user->estAdministrateur() || $user->hasPermission('gerer_appels')) {
            $appels = AppelTelephonique::where(function ($query) use ($like) {
                $query->where('appelant_nom', 'like', $like)
                    ->orWhere('objet', 'like', $like)
                    ->orWhere('message', 'like', $like)
                    ->orWhere('personne_concernee_texte', 'like', $like);
            })
                ->orderByDesc('date_appel')
                ->limit(self::LIMITE)
                ->get()
                ->map(fn (AppelTelephonique $a) => [
                    'id' => $a->id,
                    'titre' => $a->objet ?: $a->message,
                    'sousTitre' => $a->appelant_nom,
                    'lien' => "/appels?appel={$a->id}",
                ]);
        }

        $cheques = collect();
        if ($user->estAdministrateur() || $user->hasPermission('gerer_cheques')) {
            $cheques = Cheque::where(function ($query) use ($like) {
                $query->where('numero_cheque', 'like', $like)
                    ->orWhere('nom_emetteur', 'like', $like)
                    ->orWhere('nom_beneficiaire', 'like', $like)
                    ->orWhere('banque_emettrice', 'like', $like);
            })
                ->orderByDesc('date_emission')
                ->limit(self::LIMITE)
                ->get()
                ->map(fn (Cheque $c) => [
                    'id' => $c->id,
                    'titre' => "Chèque n°{$c->numero_cheque}",
                    'sousTitre' => $c->nom_emetteur,
                    'lien' => "/cheques?cheque={$c->id}",
                ]);
        }

        $pai = PaiDossier::where(function ($query) use ($like) {
            $query->where('titre', 'like', $like)
                ->orWhere('nom_beneficiaire', 'like', $like);
        })
            ->orderByDesc('date_ouverture')
            ->limit(self::LIMITE)
            ->get()
            ->map(fn (PaiDossier $p) => [
                'id' => $p->id,
                'titre' => $p->titre,
                'sousTitre' => $p->nomBeneficiaire(),
                'lien' => "/pai/{$p->id}",
            ]);

        return response()->json([
            'personnes' => $personnes,
            'documents' => $documents,
            'courriers' => $courriers,
            'appels' => $appels,
            'cheques' => $cheques,
            'pai' => $pai,
        ], 200);
    }
}
