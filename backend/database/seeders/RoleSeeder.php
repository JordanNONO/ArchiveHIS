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
        // Super Administrateur : le seul rôle qui garde les droits vraiment
        // sensibles (gérer les comptes/rôles/permissions/services métier) —
        // demande explicite du responsable de l'association, réservé à
        // quelques comptes précis seulement (pas à tous les Administrateurs).
        // Reçoit littéralement tout, comme l'Administrateur avant ce
        // changement — c'est délibérément le seul rôle qui garde ce
        // comportement "toutes permissions".
        $superAdministrateur = RoleUsers::updateOrCreate(
            ['code_role' => 'SUPER_ADMIN'],
            ['nom' => 'Super Administrateur', 'acreditation' => 'Full Access', 'service_metier_id' => null]
        );
        $superAdministrateur->permissions()->sync(Permission::pluck('id'));

        // Administrateur "normal" : garde tout ce qui concerne la gestion
        // documentaire (toujours transverse, tous services) mais PLUS les
        // droits qui touchent aux comptes/rôles/permissions/services métier —
        // ceux-là ne relèvent désormais que du Super Administrateur ci-dessus.
        // gerer_categories n'en fait pas partie : organiser les dossiers
        // documentaires reste une action "documentaire", pas une décision de
        // gouvernance sur qui a accès à quoi.
        $permissionsSensibles = ['gerer_roles', 'gerer_permissions', 'gerer_utilisateurs', 'gerer_services_metier'];
        $administrator = RoleUsers::updateOrCreate(
            ['code_role' => 'ADMIN'],
            ['nom' => 'Administrator', 'acreditation' => 'Full Access', 'service_metier_id' => null]
        );
        $administrator->permissions()->sync(
            Permission::whereNotIn('code_perm', $permissionsSensibles)->pluck('id')
        );

        // Bascule automatiquement le compte fondateur vers Super Administrateur
        // (au lieu de rester Administrator, qui vient de perdre gerer_utilisateurs
        // ci-dessus) — sans ça, ce compte se retrouverait fermé dehors de sa
        // propre gestion des comptes/rôles au moment même où ce seeder tourne
        // (plus personne n'aurait gerer_utilisateurs pour le réassigner ensuite
        // depuis l'interface). Remplace le rôle plutôt que de l'ajouter en plus
        // (sync, pas attach) : Super Administrateur couvre déjà tout ce
        // qu'apportait Administrator, garder les deux ferait juste planer une
        // ambiguïté sur le rôle "affiché" en façade (voir AuthController::me()).
        $compteFondateur = \App\Models\Utilisateurs::where('mail', 'jordannono2245@gmail.com')->first();
        $compteFondateur?->roles()->sync([$superAdministrateur->id]);

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
        $permsEditeurService = Permission::whereIn('code_perm', ['gerer_categories', 'creer_documents', 'valider_documents', 'archiver_documents', 'editer_documents_word'])->pluck('id');
        // Seul l'Éditeur du service Comptabilité/Paie reçoit en plus
        // traiter_courrier — voir DocumentController::resoudreCourrier(), qui
        // vérifie désormais cette permission plutôt qu'un code de rôle en dur,
        // pour que ce droit reste gérable depuis la vue "Gérer les permissions".
        $permTraiterCourrier = Permission::where('code_perm', 'traiter_courrier')->pluck('id');
        // gerer_cheques (registre des chèques reçus) : accordé à Comptabilité/
        // Paie (qui les traite/rapproche) ET à l'Administratif (souvent le
        // premier point de contact — un chèque arrive fréquemment par
        // courrier) — toujours pas ouvert à chaque service comme gerer_appels,
        // mais plus large que traiter_courrier ci-dessus, réservé lui à la
        // seule Comptabilité/Paie.
        $permGererCheques = Permission::where('code_perm', 'gerer_cheques')->pluck('id');
        $servicesGererCheques = ['COMPTA', 'ADMINISTRATIF'];
        // gerer_appels (registre des appels téléphoniques) : n'importe quel
        // membre du personnel peut décrocher le téléphone, donc accordé à
        // l'Éditeur de CHAQUE service (pas réservé à un seul comme
        // traiter_courrier ci-dessus) — repris aussi plus bas pour les
        // Responsables Secteur.
        $permGererAppels = Permission::where('code_perm', 'gerer_appels')->pluck('id');
        foreach (ServiceMetier::all() as $service) {
            $editeur = RoleUsers::firstOrCreate(
                ['code_role' => 'EDITOR_' . $service->code_service],
                ['nom' => "Éditeur {$service->nom_service}", 'acreditation' => 'Edit Access', 'service_metier_id' => $service->id]
            );
            $permsRole = $permsEditeurService->merge($permGererAppels);
            if ($service->code_service === 'COMPTA') {
                $permsRole = $permsRole->merge($permTraiterCourrier);
            }
            if (in_array($service->code_service, $servicesGererCheques, true)) {
                $permsRole = $permsRole->merge($permGererCheques);
            }
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
        // assistant_redaction : réservé à l'encadrement (Administrateur — qui
        // l'a de toute façon via la synchronisation "tous les droits" plus
        // haut — et Responsables Secteur), pas à chaque Éditeur de service.
        // Tout le monde garde la recherche de documents par l'assistant, seule
        // la rédaction (réponse à un courrier, email...) est restreinte — voir
        // AssistantController::repondre().
        $permAssistantRedaction = Permission::where('code_perm', 'assistant_redaction')->pluck('id');
        foreach (['RS', 'RS_QUALITE', 'RS_EXPLOITATION', 'RS_COORDINATION'] as $codeRoleRS) {
            $roleRS = RoleUsers::where('code_role', $codeRoleRS)->first();
            $roleRS?->permissions()->syncWithoutDetaching($permArchiverDocuments->merge($permGererAppels)->merge($permAssistantRedaction));
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
