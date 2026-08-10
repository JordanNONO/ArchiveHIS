<?php

namespace Database\Seeders;

use App\Models\CategorieDocument;
use App\Models\ServiceMetier;
use Illuminate\Database\Seeder;

class CategorieDocumentSeeder extends Seeder
{
    /**
     * Les 13 catégories métier fixes du diagramme (CategorieDocument), chacune
     * rattachée au service qui en est propriétaire (voir ServiceMetierSeeder) —
     * détermine qui voit par défaut les documents confidentiels qui y sont rangés.
     */
    public function run(): void
    {
        $categories = [
            ['code' => 'RecrutementIntegration', 'libelle_cat' => 'Recrutement & Intégration', 'service' => 'RH'],
            ['code' => 'ContratDossier', 'libelle_cat' => 'Contrat & Dossier salarié', 'service' => 'RH'],
            ['code' => 'CongesAbsences', 'libelle_cat' => 'Congés & Absences', 'service' => 'RH'],
            ['code' => 'SanteAccidentTravail', 'libelle_cat' => 'Santé & Accident du travail', 'service' => 'RH'],
            ['code' => 'DisciplineContentieux', 'libelle_cat' => 'Discipline & Contentieux', 'service' => 'RH'],
            ['code' => 'EntretienEvaluation', 'libelle_cat' => 'Entretien & Évaluation', 'service' => 'RH'],
            ['code' => 'FormationContinue', 'libelle_cat' => 'Formation continue', 'service' => 'RH'],
            ['code' => 'SortieRupture', 'libelle_cat' => 'Sortie & Rupture', 'service' => 'RH'],
            ['code' => 'QualiteRisque', 'libelle_cat' => 'Qualité & Risque', 'service' => 'QUALITE'],
            ['code' => 'GestionbenSecteur', 'libelle_cat' => 'Gestion bénéficiaires & secteur', 'service' => 'ADMINISTRATIF'],
            ['code' => 'ComptpaieFinance', 'libelle_cat' => 'Comptabilité, Paie & Finance', 'service' => 'COMPTA'],
            ['code' => 'ComMarketing', 'libelle_cat' => 'Communication & Marketing', 'service' => 'COM'],
            ['code' => 'SystemTelegestion', 'libelle_cat' => 'Système & Télégestion', 'service' => 'SI'],
        ];

        foreach ($categories as $categorie) {
            $service = ServiceMetier::where('code_service', $categorie['service'])->first();

            CategorieDocument::updateOrCreate(
                ['code' => $categorie['code']],
                [
                    'libelle_cat' => $categorie['libelle_cat'],
                    'service_metier_id' => $service?->id,
                ]
            );
        }
    }
}
