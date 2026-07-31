<?php

namespace Database\Seeders;

use App\Models\CategorieDocument;
use App\Models\EtapeWorkflow;
use App\Models\ServiceMetier;
use Illuminate\Database\Seeder;

class EtapeWorkflowSeeder extends Seeder
{
    /**
     * Procédure de sortie décrite par le client : courrier initial (48h, pas de
     * palier orange, alerte rouge directe si pas de réponse) -> convocation (15
     * jours, rappel à J-3) -> solde de tout compte, porté par la Comptabilité et
     * non la RH, preuve concrète qu'une même procédure traverse plusieurs services
     * -> clôture & archivage par la RH.
     */
    public function run(): void
    {
        $categorie = CategorieDocument::where('code', 'SortieRupture')->first();
        if (!$categorie) {
            return;
        }

        $rh = ServiceMetier::where('code_service', 'RH')->first();
        $compta = ServiceMetier::where('code_service', 'COMPTA')->first();

        $etapes = [
            ['ordre' => 1, 'nom' => 'Courrier initial', 'delai_heures' => 48, 'seuil_alerte_heures' => null, 'service_responsable_id' => $rh?->id],
            ['ordre' => 2, 'nom' => 'Convocation', 'delai_heures' => 15 * 24, 'seuil_alerte_heures' => 72, 'service_responsable_id' => $rh?->id],
            ['ordre' => 3, 'nom' => 'Solde de tout compte', 'delai_heures' => 10 * 24, 'seuil_alerte_heures' => 48, 'service_responsable_id' => $compta?->id],
            ['ordre' => 4, 'nom' => 'Clôture & Archivage', 'delai_heures' => 24, 'seuil_alerte_heures' => null, 'service_responsable_id' => $rh?->id],
        ];

        foreach ($etapes as $etape) {
            EtapeWorkflow::updateOrCreate(
                ['categorie_document_id' => $categorie->id, 'ordre' => $etape['ordre']],
                $etape + ['categorie_document_id' => $categorie->id]
            );
        }
    }
}
