<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\RoleUsers;
use App\Models\ServiceMetier;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $administrator = RoleUsers::create([
            'nom' => 'Administrator',
            'code_role' => 'ADMIN',
            'acreditation' => 'Full Access',
        ]);
        $administrator->permissions()->sync(Permission::pluck('id'));

        $editor = RoleUsers::create([
            'nom' => 'Editor',
            'code_role' => 'EDITOR',
            'acreditation' => 'Edit Access',
        ]);
        $editor->permissions()->sync(
            Permission::whereIn('code_perm', ['creer_documents', 'valider_documents', 'consulter_archives'])->pluck('id')
        );

        // La majorité des catégories (voir CategorieDocumentSeeder) appartiennent à la
        // RH, y compris les dossiers alimentés par les dépôts intervenant/bénéficiaire
        // (voir EspaceDossier.jsx) — sans un rôle réellement rattaché au service RH,
        // personne d'autre que l'Administrateur (qui voit tout, donc ne teste rien) ne
        // peut les consulter.
        $rh = ServiceMetier::where('code_service', 'RH')->first();
        if ($rh) {
            $editeurRh = RoleUsers::create([
                'nom' => 'Editeur RH',
                'code_role' => 'EDITOR_RH',
                'acreditation' => 'Edit Access',
                'service_metier_id' => $rh->id,
            ]);
            $editeurRh->permissions()->sync(
                Permission::whereIn('code_perm', ['gerer_categories', 'creer_documents', 'valider_documents', 'consulter_archives'])->pluck('id')
            );
        }

        $viewer = RoleUsers::create([
            'nom' => 'Viewer',
            'code_role' => 'VIEWER',
            'acreditation' => 'View Only',
        ]);
        $viewer->permissions()->sync(
            Permission::where('code_perm', 'consulter_archives')->pluck('id')
        );

        // Comptes "dépôt" : intervenants de terrain (dont les tiers réguliers comme
        // un avocat) et bénéficiaires. Ni l'un ni l'autre ne doit parcourir
        // l'archive générale — seulement déposer, et voir ce qui leur est
        // explicitement partagé (voir DocumentController::restreindreParVisibilite).
        $intervenant = RoleUsers::create([
            'nom' => 'Intervenant',
            'code_role' => 'INTERVENANT',
            'acreditation' => 'Dépôt de documents',
        ]);
        $intervenant->permissions()->sync(
            Permission::where('code_perm', 'creer_documents')->pluck('id')
        );

        $beneficiaire = RoleUsers::create([
            'nom' => 'Beneficiaire',
            'code_role' => 'BENEFICIAIRE',
            'acreditation' => 'Dépôt de documents',
        ]);
        $beneficiaire->permissions()->sync(
            Permission::where('code_perm', 'creer_documents')->pluck('id')
        );

        // Add more roles as needed
    }
}
