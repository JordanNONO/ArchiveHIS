<?php

namespace App\Http\Controllers;

use App\Models\PaiDossier;
use App\Services\HissapPaiService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Import des PAI depuis HisSAP — la liste est lue en direct dans HisSAP à
 * chaque ouverture (rien n'est mis en cache), voir HissapPaiService.
 */
class HissapPaiController extends Controller
{
    public function __construct(private HissapPaiService $service)
    {
    }

    /** Les PAI publiés dans HisSAP, avec leur état ici (nouveau / modifié / à jour). */
    public function index()
    {
        if (!$this->service->estConfigure()) {
            return response()->json(['configure' => false, 'pais' => []], 200);
        }

        try {
            $pais = $this->service->recupererTous();
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }

        $dossiers = PaiDossier::whereIn('hissap_client_id', collect($pais)->pluck('client_id'))
            ->get()
            ->keyBy('hissap_client_id');

        // Volontairement sans les données de santé ni le détail des consignes :
        // seulement ce qu'il faut pour choisir quoi importer.
        $liste = collect($pais)->map(function (array $pai) use ($dossiers) {
            $dossier = $dossiers->get($pai['client_id']);
            return [
                'id' => $pai['id'],
                'client_id' => $pai['client_id'],
                'beneficiaire' => trim(($pai['beneficiaire']['prenom'] ?? '') . ' ' . ($pai['beneficiaire']['nom'] ?? '')),
                'tuteur' => trim(($pai['tuteur']['prenom'] ?? '') . ' ' . ($pai['tuteur']['nom'] ?? '')) ?: null,
                'responsable_secteur' => $pai['responsable_secteur']['nom'] ?? null,
                'nb_objectifs' => count($this->service->lignes($pai['objectifs_de_soins'] ?? null)),
                'publie_le' => $pai['publie_le'] ?? null,
                'statut' => $this->service->statut($pai, $dossier),
                'dossier_id' => $dossier?->id,
            ];
        })->values();

        return response()->json(['configure' => true, 'pais' => $liste], 200);
    }

    public function importer(Request $request)
    {
        $validated = $request->validate([
            'client_ids' => 'required|array|min:1|max:200',
            'client_ids.*' => 'integer',
            'mois_echeance' => 'nullable|integer|min:1|max:24',
            'donnees_sante' => 'nullable|boolean',
        ]);

        try {
            $pais = collect($this->service->recupererTous())->keyBy('client_id');
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }

        $options = [
            'mois_echeance' => $validated['mois_echeance'] ?? HissapPaiService::MOIS_ECHEANCE_PAR_DEFAUT,
            'donnees_sante' => (bool) ($validated['donnees_sante'] ?? false),
        ];

        $importes = [];
        $erreurs = [];
        foreach (array_unique($validated['client_ids']) as $clientId) {
            $pai = $pais->get($clientId);
            if (!$pai) {
                $erreurs[] = "Client HisSAP n° $clientId : PAI introuvable ou plus publié.";
                continue;
            }
            try {
                $importes[] = $this->service->importer($pai, auth('api')->user(), $options)->id;
            } catch (RuntimeException $e) {
                $erreurs[] = $e->getMessage();
            }
        }

        return response()->json(['dossier_ids' => $importes, 'erreurs' => $erreurs], $importes ? 200 : 422);
    }

    public function resynchroniser(int $id)
    {
        $dossier = PaiDossier::findOrFail($id);
        $utilisateur = auth('api')->user();
        $supervision = $utilisateur->estAdministrateur()
            || $utilisateur->roles()->where('code_role', 'EDITOR_ADMINISTRATIF')->exists();
        if (!$supervision && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }
        if (!$dossier->hissap_client_id) {
            return response()->json(['error' => "Ce dossier ne vient pas de HisSAP."], 422);
        }

        try {
            $modifie = $this->service->resynchroniser($dossier);
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }

        return response()->json(['modifie' => $modifie], 200);
    }
}
