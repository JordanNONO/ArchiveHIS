<?php

namespace Database\Seeders;

use App\Models\CategorieDocument;
use Illuminate\Database\Seeder;

class CategorieDocumentSeeder extends Seeder
{
    /**
     * Les 13 catégories métier fixes du diagramme (CategorieDocument).
     */
    public function run(): void
    {
        $categories = [
            ['code' => 'RecrutementIntegration', 'libelle_cat' => 'Recrutement & Intégration'],
            ['code' => 'ContratDossier', 'libelle_cat' => 'Contrat & Dossier salarié'],
            ['code' => 'CongesAbsences', 'libelle_cat' => 'Congés & Absences'],
            ['code' => 'SanteAccidentTravail', 'libelle_cat' => 'Santé & Accident du travail'],
            ['code' => 'DisciplineContentieux', 'libelle_cat' => 'Discipline & Contentieux'],
            ['code' => 'EntretienEvaluation', 'libelle_cat' => 'Entretien & Évaluation'],
            ['code' => 'FormationContinue', 'libelle_cat' => 'Formation continue'],
            ['code' => 'SortieRupture', 'libelle_cat' => 'Sortie & Rupture'],
            ['code' => 'QualiteRisque', 'libelle_cat' => 'Qualité & Risque'],
            ['code' => 'GestionbenSecteur', 'libelle_cat' => 'Gestion bénéficiaires & secteur'],
            ['code' => 'ComptpaieFinance', 'libelle_cat' => 'Comptabilité, Paie & Finance'],
            ['code' => 'ComMarketing', 'libelle_cat' => 'Communication & Marketing'],
            ['code' => 'SystemTelegestion', 'libelle_cat' => 'Système & Télégestion'],
        ];

        foreach ($categories as $categorie) {
            CategorieDocument::updateOrCreate(['code' => $categorie['code']], $categorie);
        }
    }
}
