<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use App\Models\Cheque;
use App\Models\DocumentArchive;
use App\Models\PaiDossier;
use App\Models\Personnels;
use App\Services\VisibiliteDocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Recherche globale (Ctrl/Cmd+K, voir RechercheGlobale.jsx) — jusqu'ici
 * limitée aux PAGES de l'appli (fonctionnalitesApp.js, toujours gérées côté
 * client). Ce contrôleur ajoute la recherche dans les VRAIES données :
 * personnel, documents, courriers, appels, chèques, PAI — pour que taper un
 * nom ou une référence amène directement à la bonne fiche, pas seulement à
 * la bonne page. Mêmes règles de permission/visibilité que les pages
 * d'origine (index() de chaque registre), jamais plus permissif.
 *
 * Précision (retour utilisateur : « que ça ressorte l'information précise ») :
 * - chaque MOT de la requête doit se trouver dans l'un des champs, dans
 *   n'importe quel ordre (« paie octobre fiche » trouve « Fiche de paie
 *   d'octobre ») — avant, la phrase entière était cherchée d'un bloc ;
 * - on récupère plus de candidats que ce qu'on affiche, puis on garde les
 *   plus proches de la requête (champ identique > début de champ > début de
 *   mot > simple morceau) — avant, les 5 premiers venus selon l'ordre
 *   alphabétique ou la date, même si le résultat exact était le 6e.
 */
class RechercheController extends Controller
{
    private const LIMITE = 5;
    private const CANDIDATS = 60;

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
        $mots = $this->mots($q);

        $personnes = Personnels::with('bureau')
            ->where(fn ($query) => $this->chaqueMotDans($query, $mots, ['nom', 'prenom', 'first_phone']))
            ->limit(self::CANDIDATS)
            ->get();
        $personnes = $this->classer($personnes, $q, fn (Personnels $p) => [trim("{$p->prenom} {$p->nom}"), trim("{$p->nom} {$p->prenom}")])
            ->map(fn (Personnels $p) => [
                'id' => $p->id,
                'titre' => trim("{$p->prenom} {$p->nom}"),
                'sousTitre' => $p->bureau?->name,
            ]);

        $documentsQuery = DocumentArchive::whereNull('sens_courrier')
            ->where(fn ($query) => $this->chaqueMotDans($query, $mots, ['titre_document', 'code_reference', 'objet', 'auteur']));
        (new VisibiliteDocumentService())->restreindre($documentsQuery, $user);
        $documents = $this->classer(
            $documentsQuery->orderByDesc('created_at')->limit(self::CANDIDATS)->get(),
            $q,
            fn (DocumentArchive $d) => [$d->titre_document, $d->code_reference]
        )->map(fn (DocumentArchive $d) => [
            'id' => $d->id,
            'titre' => $d->titre_document,
            'sousTitre' => $d->code_reference,
            'lien' => "/view/{$d->id}/" . pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
        ]);

        $courriersQuery = DocumentArchive::whereNotNull('sens_courrier')
            ->where(fn ($query) => $this->chaqueMotDans($query, $mots, ['titre_document', 'objet', 'code_reference', 'expediteur_nom', 'destinataire_nom']));
        (new VisibiliteDocumentService())->restreindre($courriersQuery, $user);
        $courriers = $this->classer(
            $courriersQuery->orderByDesc('created_at')->limit(self::CANDIDATS)->get(),
            $q,
            fn (DocumentArchive $d) => [$d->code_reference, $d->objet, $d->titre_document, $d->expediteur_nom, $d->destinataire_nom]
        )->map(fn (DocumentArchive $d) => [
            'id' => $d->id,
            'titre' => $d->titre_document ?: $d->objet,
            'sousTitre' => trim(($d->code_reference ? "{$d->code_reference} · " : '') . ($d->sens_courrier === 'entrant' ? $d->expediteur_nom : $d->destinataire_nom), ' ·'),
            'lien' => "/view/{$d->id}/" . pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
        ]);

        $appels = collect();
        if ($user->estAdministrateur() || $user->hasPermission('gerer_appels')) {
            $appels = AppelTelephonique::where(fn ($query) => $this->chaqueMotDans(
                $query,
                $mots,
                ['appelant_nom', 'appelant_telephone', 'appelant_organisation', 'objet', 'message', 'personne_concernee_texte']
            ))
                ->orderByDesc('date_appel')
                ->limit(self::CANDIDATS)
                ->get();
            $appels = $this->classer($appels, $q, fn (AppelTelephonique $a) => [$a->appelant_nom, $a->objet, $a->appelant_telephone, $a->appelant_organisation])
                ->map(fn (AppelTelephonique $a) => [
                    'id' => $a->id,
                    'titre' => $a->objet ?: $a->message,
                    'sousTitre' => $a->appelant_nom,
                    'lien' => "/appels?appel={$a->id}",
                ]);
        }

        $cheques = collect();
        if ($user->estAdministrateur() || $user->hasPermission('gerer_cheques')) {
            $cheques = Cheque::where(fn ($query) => $this->chaqueMotDans(
                $query,
                $mots,
                ['numero_cheque', 'nom_emetteur', 'nom_beneficiaire', 'banque_emettrice', 'numero_bordereau_remise']
            ))
                ->orderByDesc('date_emission')
                ->limit(self::CANDIDATS)
                ->get();
            $cheques = $this->classer($cheques, $q, fn (Cheque $c) => [$c->numero_cheque, $c->nom_emetteur, $c->nom_beneficiaire])
                ->map(fn (Cheque $c) => [
                    'id' => $c->id,
                    'titre' => "Chèque n°{$c->numero_cheque}",
                    'sousTitre' => $c->nom_emetteur,
                    'lien' => "/cheques?cheque={$c->id}",
                ]);
        }

        $pai = PaiDossier::where(fn ($query) => $this->chaqueMotDans($query, $mots, ['titre', 'nom_beneficiaire']))
            ->orderByDesc('date_ouverture')
            ->limit(self::CANDIDATS)
            ->get();
        $pai = $this->classer($pai, $q, fn (PaiDossier $p) => [$p->nomBeneficiaire(), $p->titre])
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

    /** Mots de la requête, sans les plus courts (« de », « la ») s'il en reste d'autres. */
    private function mots(string $q): array
    {
        $mots = array_values(array_filter(preg_split('/[\s,;]+/u', $q), fn ($m) => $m !== ''));
        $significatifs = array_values(array_filter($mots, fn ($m) => mb_strlen($m) >= 3));

        return $significatifs ?: $mots;
    }

    /**
     * Chaque mot doit apparaître dans au moins une des colonnes (ET entre les
     * mots, OU entre les colonnes). La collation MySQL utf8mb4_unicode_ci
     * ignore déjà la casse et les accents.
     */
    private function chaqueMotDans($query, array $mots, array $colonnes): void
    {
        foreach ($mots as $mot) {
            $like = '%' . addcslashes($mot, '%_\\') . '%';
            $query->where(function ($q) use ($colonnes, $like) {
                foreach ($colonnes as $colonne) {
                    $q->orWhere($colonne, 'like', $like);
                }
            });
        }
    }

    /**
     * Garde les LIMITE résultats les plus proches de la requête. `$champs`
     * renvoie les valeurs qui comptent pour juger la proximité, la plus
     * importante en premier ; à score égal, l'ordre de la requête SQL (le
     * plus récent d'abord) départage.
     */
    private function classer(Collection $resultats, string $q, callable $champs): Collection
    {
        $requete = $this->normaliser($q);

        return $resultats
            ->values()
            ->map(function ($element, $index) use ($requete, $champs) {
                $score = 0;
                foreach (array_values($champs($element)) as $rang => $valeur) {
                    $texte = $this->normaliser((string) $valeur);
                    if ($texte === '') {
                        continue;
                    }
                    $s = match (true) {
                        $texte === $requete => 100,
                        str_starts_with($texte, $requete) => 60,
                        (bool) preg_match('/(^|[^\p{L}\p{N}])' . preg_quote($requete, '/') . '/u', $texte) => 40,
                        str_contains($texte, $requete) => 20,
                        default => 0,
                    };
                    // Le premier champ (nom, titre...) pèse un peu plus que les suivants.
                    $score = max($score, $s - $rang * 2);
                }

                return ['element' => $element, 'score' => $score, 'index' => $index];
            })
            ->sort(fn ($a, $b) => [$b['score'], $a['index']] <=> [$a['score'], $b['index']])
            ->take(self::LIMITE)
            ->pluck('element')
            ->values();
    }

    private function normaliser(string $texte): string
    {
        return trim(mb_strtolower(Str::ascii($texte)));
    }
}
