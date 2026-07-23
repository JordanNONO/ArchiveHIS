<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['code_perm' => 'gerer_utilisateurs', 'label_perm' => 'Gérer les utilisateurs'],
            ['code_perm' => 'gerer_roles', 'label_perm' => 'Gérer les rôles'],
            ['code_perm' => 'gerer_permissions', 'label_perm' => 'Gérer les permissions'],
            ['code_perm' => 'gerer_categories', 'label_perm' => 'Gérer les catégories de documents'],
            ['code_perm' => 'gerer_services_metier', 'label_perm' => 'Gérer les services métier'],
            ['code_perm' => 'creer_documents', 'label_perm' => 'Créer des documents'],
            ['code_perm' => 'valider_documents', 'label_perm' => 'Valider les transitions de statut des documents'],
            ['code_perm' => 'archiver_documents', 'label_perm' => 'Archiver des documents'],
            ['code_perm' => 'consulter_archives', 'label_perm' => 'Consulter les archives'],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(['code_perm' => $permission['code_perm']], $permission);
        }
    }
}
