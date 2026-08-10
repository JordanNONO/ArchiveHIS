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
        // updateOrCreate (pas firstOrCreate) : ces deux rôles doivent rester
        // transverses (service_metier_id NULL, "tous services" — voir
        // DocumentStatusService::validateursDuService()). Un ancien seed d'avant
        // l'introduction du cloisonnement par service avait laissé service_metier_id
        // à une valeur non nulle sur ces lignes ; firstOrCreate ne l'aurait jamais
        // corrigé puisqu'il ne touche pas une ligne déjà existante.
        $administrator = RoleUsers::updateOrCreate(
            ['code_role' => 'ADMIN'],
            ['nom' => 'Administrator', 'acreditation' => 'Full Access', 'service_metier_id' => null]
        );
        $administrator->permissions()->sync(Permission::pluck('id'));

        $editor = RoleUsers::updateOrCreate(
            ['code_role' => 'EDITOR'],
            ['nom' => 'Editor', 'acreditation' => 'Edit Access', 'service_metier_id' => null]
        );
        $editor->permissions()->sync(
            Permission::whereIn('code_perm', ['creer_documents', 'valider_documents', 'consulter_archives'])->pluck('id')
        );

        // Chaque service a la main sur ses propres dossiers (voir CategorieDocumentSeeder,
        // où chaque catégorie appartient à un seul service) : sans un rôle réellement
        // rattaché à CHAQUE service, personne d'autre que l'Administrateur (qui voit tout,
        // donc ne teste rien de spécifique à un service) ne peut les traiter. Un seul
        // rôle "Éditeur {service}" par service, symétrique — pas de traitement à part
        // pour la RH par rapport aux autres.
        //
        // Volontairement SANS consulter_archives : ce droit ouvre l'accès à tous les
        // documents PUBLIC/INTERNE de TOUS les services (voir VisibiliteDocumentService),
        // ce qui viderait de son sens le cloisonnement par service — un éditeur voit son
        // propre service en entier (via categorieDocument->service_metier_id) et ce qui
        // lui est explicitement partagé, jamais le reste par défaut.
        $permsEditeurService = Permission::whereIn('code_perm', ['gerer_categories', 'creer_documents', 'valider_documents'])->pluck('id');
        foreach (ServiceMetier::all() as $service) {
            $editeur = RoleUsers::firstOrCreate(
                ['code_role' => 'EDITOR_' . $service->code_service],
                ['nom' => "Éditeur {$service->nom_service}", 'acreditation' => 'Edit Access', 'service_metier_id' => $service->id]
            );
            $editeur->permissions()->sync($permsEditeurService);
        }

        $viewer = RoleUsers::firstOrCreate(
            ['code_role' => 'VIEWER'],
            ['nom' => 'Viewer', 'acreditation' => 'View Only']
        );
        $viewer->permissions()->sync(
            Permission::where('code_perm', 'consulter_archives')->pluck('id')
        );

        // Comptes "dépôt" : intervenants de terrain (dont les tiers réguliers comme
        // un avocat) et bénéficiaires. Ni l'un ni l'autre ne doit parcourir
        // l'archive générale — seulement déposer, et voir ce qui leur est
        // explicitement partagé (voir DocumentController::restreindreParVisibilite).
        $intervenant = RoleUsers::firstOrCreate(
            ['code_role' => 'INTERVENANT'],
            ['nom' => 'Intervenant', 'acreditation' => 'Dépôt de documents']
        );
        $intervenant->permissions()->sync(
            Permission::where('code_perm', 'creer_documents')->pluck('id')
        );

        $beneficiaire = RoleUsers::firstOrCreate(
            ['code_role' => 'BENEFICIAIRE'],
            ['nom' => 'Beneficiaire', 'acreditation' => 'Dépôt de documents']
        );
        $beneficiaire->permissions()->sync(
            Permission::where('code_perm', 'creer_documents')->pluck('id')
        );

        // Add more roles as needed
    }
}
