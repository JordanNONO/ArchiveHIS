<?php

namespace App\Http\Controllers;

use App\Models\Formation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * Support de formation interne (vidéo + PDF), un contenu unique diffusé à tout
 * le personnel interne — voir la migration create_formations_table.
 *
 * video()/pdf() ne peuvent pas être protégées par un en-tête Authorization
 * (une balise <video>/<a> ne peut pas en porter un) : même principe que
 * DocumentController::lienFichier()/show(), la signature de l'URL temporaire
 * remplace l'authentification classique sur ces deux routes.
 */
class FormationController extends Controller
{
    private function singleton(): Formation
    {
        return Formation::firstOrCreate([]);
    }

    private function ressource(Formation $formation): array
    {
        return [
            'titre' => $formation->titre,
            'description' => $formation->description,
            'video_disponible' => (bool) $formation->video_chemin,
            'video_nom_original' => $formation->video_nom_original,
            'video_url' => $formation->video_chemin
                ? URL::temporarySignedRoute('formation.video', now()->addHours(2))
                : null,
            'pdf_disponible' => (bool) $formation->pdf_chemin,
            'pdf_nom_original' => $formation->pdf_nom_original,
            'pdf_url' => $formation->pdf_chemin
                ? URL::temporarySignedRoute('formation.pdf', now()->addHours(2))
                : null,
            'mis_a_jour_le' => $formation->updated_at,
            'mis_a_jour_par' => $formation->misAJourPar?->nom,
        ];
    }

    public function show()
    {
        return response()->json($this->ressource($this->singleton()), 200);
    }

    public function update(Request $request)
    {
        if (!auth('api')->user()->estAdministrateur()) {
            return response()->json(['error' => "Seul un administrateur peut modifier le contenu de formation."], 403);
        }

        $validatedData = $request->validate([
            'titre' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string|max:2000',
            // 200 Mo (upload_max_filesize/post_max_size serveur : 220M)
            'video' => 'sometimes|file|mimetypes:video/mp4,video/webm,video/quicktime,video/x-matroska|max:204800',
            'pdf' => 'sometimes|file|extensions:pdf|max:51200',
        ]);

        $formation = $this->singleton();
        $donnees = collect($validatedData)->only(['titre', 'description'])->toArray();

        if ($request->hasFile('video')) {
            if ($formation->video_chemin) {
                Storage::disk('local')->delete($formation->video_chemin);
            }
            $fichier = $request->file('video');
            $donnees['video_chemin'] = $fichier->store('formation', 'local');
            $donnees['video_nom_original'] = $fichier->getClientOriginalName();
            $donnees['video_mime'] = $fichier->getMimeType();
        }

        if ($request->hasFile('pdf')) {
            if ($formation->pdf_chemin) {
                Storage::disk('local')->delete($formation->pdf_chemin);
            }
            $fichier = $request->file('pdf');
            $donnees['pdf_chemin'] = $fichier->store('formation', 'local');
            $donnees['pdf_nom_original'] = $fichier->getClientOriginalName();
        }

        $donnees['mis_a_jour_par'] = auth('api')->id();
        $formation->update($donnees);

        return response()->json($this->ressource($formation->fresh('misAJourPar')), 200);
    }

    public function video()
    {
        $formation = $this->singleton();
        abort_unless($formation->video_chemin, 404);

        return response()->file(Storage::disk('local')->path($formation->video_chemin), [
            'Content-Type' => $formation->video_mime ?? 'video/mp4',
        ]);
    }

    public function pdf(Request $request)
    {
        $formation = $this->singleton();
        abort_unless($formation->pdf_chemin, 404);

        $headers = ['Content-Type' => 'application/pdf'];
        if ($request->boolean('download')) {
            $headers['Content-Disposition'] = 'attachment; filename="' . ($formation->pdf_nom_original ?: 'formation.pdf') . '"';
        }

        return response()->file(Storage::disk('local')->path($formation->pdf_chemin), $headers);
    }
}
