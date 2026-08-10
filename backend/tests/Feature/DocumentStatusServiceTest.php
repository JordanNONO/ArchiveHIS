<?php

namespace Tests\Feature;

use App\Enums\StatutDocument;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\Permission;
use App\Models\RoleUsers;
use App\Models\ServiceMetier;
use App\Models\Utilisateurs;
use App\Services\DocumentStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Régression directe du bug de notification de cette session : un
 * intervenant avait déposé une réclamation sans qu'aucun administrateur ne
 * soit notifié. Cause racine : un rôle "Administrator" avec un
 * service_metier_id non nul (RoleSeeder utilisait firstOrCreate, qui ne
 * corrige jamais une ligne existante) + la requête de validateursDuService()
 * qui ne traitait pas service_metier_id=NULL comme "tous services". Les deux
 * ont été corrigés ; ces tests figent le comportement attendu.
 */
class DocumentStatusServiceTest extends TestCase
{
    use RefreshDatabase;

    private function permissionValiderDocuments(): Permission
    {
        return Permission::firstOrCreate(
            ['code_perm' => 'valider_documents'],
            ['label_perm' => 'Valider les documents']
        );
    }

    public function test_un_role_transverse_service_metier_id_null_est_notifie_pour_tous_les_services(): void
    {
        $service = ServiceMetier::factory()->create();
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $service->id]);
        $document = DocumentArchive::factory()->create(['categorie_id' => $categorie->id]);

        $roleTransverse = RoleUsers::factory()->create(['service_metier_id' => null]);
        $roleTransverse->permissions()->attach($this->permissionValiderDocuments());
        $administrateur = Utilisateurs::factory()->create();
        $administrateur->roles()->attach($roleTransverse);

        $validateurs = (new DocumentStatusService())->validateursDuService($document);

        $this->assertTrue($validateurs->contains('id', $administrateur->id));
    }

    public function test_un_role_dun_autre_service_nest_pas_notifie(): void
    {
        $serviceDocument = ServiceMetier::factory()->create();
        $autreService = ServiceMetier::factory()->create();
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $serviceDocument->id]);
        $document = DocumentArchive::factory()->create(['categorie_id' => $categorie->id]);

        $roleAutreService = RoleUsers::factory()->create(['service_metier_id' => $autreService->id]);
        $roleAutreService->permissions()->attach($this->permissionValiderDocuments());
        $utilisateurAutreService = Utilisateurs::factory()->create();
        $utilisateurAutreService->roles()->attach($roleAutreService);

        $validateurs = (new DocumentStatusService())->validateursDuService($document);

        $this->assertFalse($validateurs->contains('id', $utilisateurAutreService->id));
    }

    public function test_le_deposant_lui_meme_est_exclu_des_validateurs(): void
    {
        $service = ServiceMetier::factory()->create();
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $service->id]);
        $document = DocumentArchive::factory()->create(['categorie_id' => $categorie->id]);

        $role = RoleUsers::factory()->create(['service_metier_id' => $service->id]);
        $role->permissions()->attach($this->permissionValiderDocuments());
        $deposant = Utilisateurs::factory()->create();
        $deposant->roles()->attach($role);

        $validateurs = (new DocumentStatusService())->validateursDuService($document, $deposant->id);

        $this->assertFalse($validateurs->contains('id', $deposant->id));
    }

    public function test_archive_nest_atteignable_que_depuis_valide_et_traite(): void
    {
        $document = DocumentArchive::factory()->create(['status_doc' => StatutDocument::SOUMIS->value]);

        $this->expectException(\InvalidArgumentException::class);

        (new DocumentStatusService())->transitionTo($document, StatutDocument::ARCHIVE->value);
    }

    public function test_transition_valide_change_bien_le_statut_et_journalise(): void
    {
        $document = DocumentArchive::factory()->create(['status_doc' => StatutDocument::VALIDE_ET_TRAITE->value]);

        $document = (new DocumentStatusService())->transitionTo($document, StatutDocument::ARCHIVE->value);

        $this->assertSame(StatutDocument::ARCHIVE->value, $document->fresh()->status_doc);
        $this->assertNotNull($document->fresh()->date_archivage);
        $this->assertDatabaseHas('historique_statuts', [
            'document_archive_id' => $document->id,
            'ancien_statut' => StatutDocument::VALIDE_ET_TRAITE->value,
            'nouveau_statut' => StatutDocument::ARCHIVE->value,
        ]);
    }
}
