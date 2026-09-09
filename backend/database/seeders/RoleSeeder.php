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
        // archiver_documents : malgré son nom, ne gère PAS le passage au statut
        // "Archivé" (ça, c'est valider_documents, déjà accordé ci-dessous) mais
        // deux actions bien réelles que chaque service doit pouvoir faire sur
        // ses propres documents : déposer une nouvelle version, et
        // verrouiller/déverrouiller un dossier (voir routes newVersion()/
        // verrouiller()/deverrouiller()). Absente ici jusqu'ici, ce qui les
        // réservait de fait au seul Administrateur.
        $permsEditeurService = Permission::whereIn('code_perm', ['gerer_categories', 'creer_documents', 'valider_documents', 'archiver_documents'])->pluck('id');
        // Seul l'Éditeur du service Comptabilité/Paie reçoit en plus
        // traiter_courrier — voir DocumentController::resoudreCourrier(), qui
        // vérifie désormais cette permission plutôt qu'un code de rôle en dur,
        // pour que ce droit reste gérable depuis la vue "Gérer les permissions".
        $permTraiterCourrier = Permission::where('code_perm', 'traiter_courrier')->pluck('id');
        foreach (ServiceMetier::all() as $service) {
            $editeur = RoleUsers::firstOrCreate(
                ['code_role' => 'EDITOR_' . $service->code_service],
                ['nom' => "Éditeur {$service->nom_service}", 'acreditation' => 'Edit Access', 'service_metier_id' => $service->id]
            );
            $permsRole = $service->code_service === 'COMPTA'
                ? $permsEditeurService->merge($permTraiterCourrier)
                : $permsEditeurService;
            $editeur->permissions()->sync($permsRole);
        }

        // "Responsable Secteur Qualité" (RS_QUALITE, voir la migration
        // creer_roles_specialises_responsable_secteur) traite les documents
        // Qualité (lu et approuvé/rejeté) — pas l'Éditeur Qualité générique
        // du service, qui n'est pas le vrai interlocuteur ici. syncWithoutDetaching
        // (pas sync) : ce rôle existe déjà avec ses propres permissions
        // (copiées du Responsable Secteur générique à sa création), on ajoute
        // juste ce droit sans y toucher. Pas d'erreur si le rôle n'existe pas
        // encore (ex: base fraîchement seedée sans être passée par cette migration).
        $roleQualite = RoleUsers::where('code_role', 'RS_QUALITE')->first();
        if ($roleQualite) {
            $roleQualite->permissions()->syncWithoutDetaching(
                Permission::where('code_perm', 'traiter_qualite')->pluck('id')
            );
        }

        // Responsable Secteur (générique + spécialisés Qualité/Exploitation/
        // Coordination, voir la migration creer_roles_specialises_responsable_secteur) :
        // mêmes deux actions que les Éditeurs de service ci-dessus (nouvelle
        // version, verrouillage) sur les documents qu'ils gèrent au quotidien.
        // syncWithoutDetaching, pas sync : ces rôles ne sont pas gérés dans leur
        // ensemble par ce seeder (permissions historiques créées ailleurs), on
        // ajoute seulement ce droit sans toucher au reste. Pas d'erreur si un
        // rôle n'existe pas encore (base fraîchement seedée).
        $permArchiverDocuments = Permission::where('code_perm', 'archiver_documents')->pluck('id');
        foreach (['RS', 'RS_QUALITE', 'RS_EXPLOITATION', 'RS_COORDINATION'] as $codeRoleRS) {
            $roleRS = RoleUsers::where('code_role', $codeRoleRS)->first();
            $roleRS?->permissions()->syncWithoutDetaching($permArchiverDocuments);
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
