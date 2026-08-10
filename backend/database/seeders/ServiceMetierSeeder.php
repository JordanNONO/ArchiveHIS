<?php

namespace Database\Seeders;

use App\Models\ServiceMetier;
use Illuminate\Database\Seeder;

class ServiceMetierSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            ['code_service' => 'RH', 'nom_service' => 'Ressources Humaines'],
            ['code_service' => 'QUALITE', 'nom_service' => 'Qualité & Gestion des Risques'],
            ['code_service' => 'COMPTA', 'nom_service' => 'Comptabilité, Paie & Finance'],
            ['code_service' => 'COM', 'nom_service' => 'Communication & Marketing'],
            ['code_service' => 'SI', 'nom_service' => 'Système & Télégestion'],
            ['code_service' => 'DIRECTION', 'nom_service' => 'Direction Générale'],
            // Gère au quotidien les dossiers bénéficiaires (réclamations, signalements,
            // prestations...) — voir CategorieDocumentSeeder (GestionbenSecteur).
            ['code_service' => 'ADMINISTRATIF', 'nom_service' => 'Administratif'],
        ];

        foreach ($services as $service) {
            ServiceMetier::firstOrCreate(['code_service' => $service['code_service']], $service);
        }
    }
}
