<?php

namespace App\Http\Controllers;

use App\Models\FolderExport;
use Illuminate\Support\Facades\Storage;

class TelechargementController extends Controller
{
    /**
     * Demandes de téléchargement groupé de l'utilisateur connecté (en cours et
     * passées), pour savoir où en est une préparation d'archive.
     */
    public function index()
    {
        $exports = FolderExport::where('utilisateur_id', auth('api')->id())
            ->latest()
            ->limit(20)
            ->get();

        return response()->json($exports, 200);
    }

    /**
     * Télécharge le ZIP une fois prêt. Accessible via un lien signé à durée
     * limitée (voir FolderExportReadyNotification) plutôt qu'un jeton d'API,
     * puisqu'un simple clic sur un lien de notification ne peut pas transmettre
     * l'en-tête d'autorisation — la signature de l'URL fait foi à sa place.
     */
    public function fichier(int $id)
    {
        $export = FolderExport::findOrFail($id);

        if ($export->statut !== 'pret' || !$export->chemin_fichier) {
            return response()->json(['error' => "Cette archive n'est pas encore prête."], 409);
        }

        if (!Storage::disk('local')->exists($export->chemin_fichier)) {
            return response()->json(['error' => 'Ce fichier a expiré ou a déjà été nettoyé.'], 410);
        }

        $nomZip = preg_replace('/[^\p{L}\p{N}_\- ]/u', '', $export->nom_dossier) . '.zip';

        return response()->download(Storage::disk('local')->path($export->chemin_fichier), $nomZip);
    }
}
