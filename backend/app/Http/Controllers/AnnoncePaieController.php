<?php

namespace App\Http\Controllers;

use App\Models\AnnoncePaie;
use App\Models\FluctuationRhMois;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Annonces à la paie du mois (voir AnnoncePaie) — affichées dans la page
 * Fluctuation RH, section "Dossier & discipline".
 *
 * Mêmes droits que la fluctuation : lecture dès consulter_fluctuation_rh,
 * écriture réservée à gerer_fluctuation_rh (voir routes/api.php). La saisie
 * suit le verrou du mois comme les lignes de fluctuation ; le changement de
 * statut, lui, reste possible sur un mois validé — transmettre une annonce
 * et accuser sa lecture appartiennent à son propre circuit, qui se poursuit
 * après la clôture du mois.
 */
class AnnoncePaieController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate(['mois' => 'required|date_format:Y-m']);

        $annonces = AnnoncePaie::with(['utilisateur.personnels', 'transmisPar.personnels'])
            ->where('mois', $this->premierDuMois($validated['mois']))
            ->orderByDesc('created_at')
            ->get();

        return response()->json($annonces, 200);
    }

    public function store(Request $request)
    {
        $validated = $this->valider($request, true);

        if ($erreur = $this->refusSiVerrouille($validated['mois'])) {
            return $erreur;
        }

        $fichier = $request->file('piece_jointe');
        $validated['utilisateur_id'] = auth('api')->id();
        $validated['reference'] = $this->prochaineReference($validated['mois']);
        unset($validated['piece_jointe']);

        $annonce = AnnoncePaie::create($validated);
        $this->attacherPiece($annonce, $fichier);

        return response()->json($annonce->fresh()->load('utilisateur.personnels'), 201);
    }

    public function update(Request $request, AnnoncePaie $annonce)
    {
        $validated = $this->valider($request, false);

        if ($erreur = $this->refusSiVerrouille($annonce->mois->format('Y-m-d'))) {
            return $erreur;
        }

        $fichier = $request->file('piece_jointe');
        $validated['modifie_par_id'] = auth('api')->id();
        unset($validated['piece_jointe'], $validated['mois']);

        $annonce->update($validated);
        $this->attacherPiece($annonce, $fichier);

        return response()->json($annonce->fresh()->load(['utilisateur.personnels', 'transmisPar.personnels']), 200);
    }

    public function destroy(AnnoncePaie $annonce)
    {
        if ($erreur = $this->refusSiVerrouille($annonce->mois->format('Y-m-d'))) {
            return $erreur;
        }

        if ($annonce->piece_jointe) {
            Storage::disk(config('filesystems.document_disk'))->delete($annonce->piece_jointe);
        }
        $annonce->delete();

        return response()->json(['message' => 'Annonce supprimée.'], 200);
    }

    /**
     * Avance une annonce dans son circuit. On ne saute pas d'étape et on ne
     * revient en arrière que d'un cran ("rouvrir"), pour que l'historique
     * reste lisible par la paie.
     */
    public function changerStatut(Request $request, AnnoncePaie $annonce)
    {
        $validated = $request->validate([
            'statut' => ['required', Rule::in(AnnoncePaie::STATUTS)],
        ]);

        $champs = ['statut' => $validated['statut'], 'modifie_par_id' => auth('api')->id()];

        if ($validated['statut'] === AnnoncePaie::STATUT_TRANSMIS && !$annonce->transmis_le) {
            $champs['transmis_le'] = now();
            $champs['transmis_par_id'] = auth('api')->id();
        }
        if ($validated['statut'] === AnnoncePaie::STATUT_LU && !$annonce->lu_le) {
            $champs['lu_le'] = now();
        }
        // Retour en arrière : on efface la trace de l'étape abandonnée,
        // sinon la fiche afficherait "lue le 4" sur une annonce à retransmettre.
        if (in_array($validated['statut'], [AnnoncePaie::STATUT_BROUILLON, AnnoncePaie::STATUT_A_TRANSMETTRE], true)) {
            $champs['transmis_le'] = null;
            $champs['transmis_par_id'] = null;
            $champs['lu_le'] = null;
        }
        if ($validated['statut'] === AnnoncePaie::STATUT_TRANSMIS) {
            $champs['lu_le'] = null;
        }

        $annonce->update($champs);

        return response()->json($annonce->fresh()->load(['utilisateur.personnels', 'transmisPar.personnels']), 200);
    }

    /** Affiche le justificatif dans le navigateur — même principe que le scan d'un chèque. */
    public function piece(AnnoncePaie $annonce)
    {
        if (!$annonce->piece_jointe || !Storage::disk(config('filesystems.document_disk'))->exists($annonce->piece_jointe)) {
            abort(404);
        }

        $extension = strtolower(pathinfo($annonce->piece_jointe, PATHINFO_EXTENSION));
        $mime = \Symfony\Component\Mime\MimeTypes::getDefault()->getMimeTypes($extension)[0] ?? 'application/octet-stream';

        return response(Storage::disk(config('filesystems.document_disk'))->get($annonce->piece_jointe))
            ->header('Content-Type', $mime)
            ->header('Content-Disposition', 'inline; filename="' . ($annonce->piece_jointe_nom ?: "annonce_{$annonce->id}.{$extension}") . '"');
    }

    /**
     * `donnees` arrive en multipart (le formulaire envoie aussi un fichier) :
     * ses champs sont donc des chaînes plates, filtrées ici sur les clés que
     * le type attend réellement.
     */
    private function valider(Request $request, bool $creation): array
    {
        $regles = [
            'type' => ['required', Rule::in(AnnoncePaie::TYPES)],
            'salarie' => 'nullable|string|max:255',
            'date_effet' => 'nullable|date',
            'message' => 'nullable|string|max:2000',
            'statut' => ['nullable', Rule::in(AnnoncePaie::STATUTS)],
            'inclure_export' => 'nullable|boolean',
            'donnees' => 'nullable|array',
            'donnees.*' => 'nullable|string|max:255',
            'piece_jointe' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ];
        if ($creation) {
            $regles['mois'] = 'required|date_format:Y-m';
        }

        $validated = $request->validate($regles);

        if ($creation) {
            $validated['mois'] = $this->premierDuMois($validated['mois']);
        }
        if (isset($validated['salarie'])) {
            $validated['salarie'] = trim($validated['salarie']) ?: null;
        }

        $attendus = AnnoncePaie::CHAMPS[$validated['type']] ?? [];
        $validated['donnees'] = $attendus
            ? array_filter(
                array_intersect_key($validated['donnees'] ?? [], array_flip($attendus)),
                fn ($valeur) => $valeur !== null && $valeur !== ''
            )
            : null;

        return $validated;
    }

    private function attacherPiece(AnnoncePaie $annonce, $fichier): void
    {
        if (!$fichier) {
            return;
        }

        // Le justificatif a besoin de l'id de l'annonce pour son dossier, il
        // est donc rattaché après la création (comme le scan d'un chèque).
        if ($annonce->piece_jointe) {
            Storage::disk(config('filesystems.document_disk'))->delete($annonce->piece_jointe);
        }

        $extension = strtolower($fichier->getClientOriginalExtension());
        $chemin = "annonces-paie/{$annonce->id}/justificatif.{$extension}";
        Storage::disk(config('filesystems.document_disk'))->put($chemin, file_get_contents($fichier->getRealPath()));
        $annonce->update([
            'piece_jointe' => $chemin,
            'piece_jointe_nom' => $fichier->getClientOriginalName(),
        ]);
    }

    private function refusSiVerrouille(string $mois)
    {
        if (FluctuationRhMois::estVerrouille($mois)) {
            return response()->json(['error' => 'Ce mois est validé : rouvrez-le avant de le modifier.'], 423);
        }

        return null;
    }

    private function premierDuMois(string $mois): string
    {
        return Carbon::createFromFormat('Y-m', $mois)->startOfMonth()->format('Y-m-d');
    }

    /**
     * Numéro cité par HIS et le cabinet pour parler de la même annonce :
     * AP-2026-11-0042, remis à 1 chaque mois. Calculé sur le nombre
     * d'annonces du mois plutôt que sur l'id global, pour rester lisible.
     */
    private function prochaineReference(string $mois): string
    {
        $rang = AnnoncePaie::where('mois', $mois)->count() + 1;

        return sprintf('AP-%s-%04d', substr($mois, 0, 7), $rang);
    }
}
