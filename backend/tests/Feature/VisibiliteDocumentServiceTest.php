<?php

namespace Tests\Feature;

use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\Permission;
use App\Models\RoleUsers;
use App\Models\ServiceMetier;
use App\Models\Share;
use App\Models\Utilisateurs;
use App\Services\VisibiliteDocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Règle de visibilité unique (voir VisibiliteDocumentService) : la structure
 * reste toujours navigable, mais le contenu d'un dossier hors de son service
 * reste vide sauf partage explicite. Ces tests figent les cas qui ont motivé
 * la centralisation (CategorieController::show()/download(),
 * TypeDocumentController::download(), GenererZipDossier laissaient
 * auparavant passer n'importe quel document).
 */
class VisibiliteDocumentServiceTest extends TestCase
{
    use RefreshDatabase;

    private function utilisateurAvecRole(array $attributsRole = [], array $codesPermission = []): Utilisateurs
    {
        $role = RoleUsers::factory()->create($attributsRole);
        if ($codesPermission) {
            $permissions = collect($codesPermission)->map(
                fn ($code) => Permission::firstOrCreate(['code_perm' => $code], ['label_perm' => $code])
            );
            $role->permissions()->attach($permissions->pluck('id'));
        }
        $utilisateur = Utilisateurs::factory()->create();
        $utilisateur->roles()->attach($role);

        return $utilisateur;
    }

    public function test_administrateur_voit_tout_meme_un_document_confidentiel_dun_autre_service(): void
    {
        $administrateur = $this->utilisateurAvecRole(['nom' => 'Administrator']);
        $document = DocumentArchive::factory()->create(['niveau_confidentialite' => 'CONFIDENTIEL']);

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $administrateur));
    }

    public function test_lauteur_voit_toujours_son_propre_document(): void
    {
        $utilisateur = $this->utilisateurAvecRole();
        $document = DocumentArchive::factory()->create([
            'utilisateur_id' => $utilisateur->id,
            'niveau_confidentialite' => 'CONFIDENTIEL',
        ]);

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }

    public function test_un_document_confidentiel_dun_autre_service_reste_invisible_sans_partage(): void
    {
        $serviceUtilisateur = ServiceMetier::factory()->create();
        $serviceDocument = ServiceMetier::factory()->create();
        $utilisateur = $this->utilisateurAvecRole(['service_metier_id' => $serviceUtilisateur->id], ['consulter_archives']);
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $serviceDocument->id]);
        $document = DocumentArchive::factory()->create([
            'categorie_id' => $categorie->id,
            'niveau_confidentialite' => 'CONFIDENTIEL',
        ]);

        $this->assertFalse((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }

    public function test_un_document_partage_explicitement_devient_visible(): void
    {
        $utilisateur = $this->utilisateurAvecRole();
        $document = DocumentArchive::factory()->create(['niveau_confidentialite' => 'CONFIDENTIEL']);
        // shareable_type via associate() plutôt qu'un FQCN écrit à la main : un
        // alias de morph map ('document') est enregistré dans AppServiceProvider,
        // écrire la FQCN directement ne matcherait pas la relation shares().
        $share = new Share([
            'utilisateur_id' => $document->utilisateur_id,
            'destinataire_utilisateur_id' => $utilisateur->id,
            'permissions' => 'read',
        ]);
        $share->shareable()->associate($document);
        $share->save();

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }

    public function test_un_compte_depot_sans_consulter_archives_ne_voit_pas_les_documents_publics_dautrui(): void
    {
        $depot = $this->utilisateurAvecRole(['nom' => 'Intervenant'], ['creer_documents']);
        $document = DocumentArchive::factory()->create(['niveau_confidentialite' => 'PUBLIC']);

        $this->assertFalse((new VisibiliteDocumentService())->estVisiblePar($document, $depot));
    }

    public function test_un_dossier_partage_rend_visibles_tous_ses_documents(): void
    {
        $utilisateur = $this->utilisateurAvecRole();
        $categorie = CategorieDocument::factory()->create();
        $document = DocumentArchive::factory()->create([
            'categorie_id' => $categorie->id,
            'niveau_confidentialite' => 'CONFIDENTIEL',
        ]);

        $this->assertFalse((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));

        $share = new Share([
            'utilisateur_id' => $document->utilisateur_id,
            'destinataire_utilisateur_id' => $utilisateur->id,
            'permissions' => 'read',
        ]);
        $share->shareable()->associate($categorie);
        $share->save();

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }

    public function test_le_personnel_interne_voit_un_document_interne_dun_autre_service(): void
    {
        // Être informé ne veut pas dire pouvoir traiter (voir
        // DocumentStatusService::peutValider) — mais tout le personnel interne
        // doit voir ce qui n'est pas confidentiel, quel que soit son service.
        $serviceUtilisateur = ServiceMetier::factory()->create();
        $serviceDocument = ServiceMetier::factory()->create();
        $utilisateur = $this->utilisateurAvecRole(['service_metier_id' => $serviceUtilisateur->id]);
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $serviceDocument->id]);
        $document = DocumentArchive::factory()->create([
            'categorie_id' => $categorie->id,
            'niveau_confidentialite' => 'INTERNE',
        ]);

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }

    public function test_meme_service_metier_rend_le_document_visible_sans_partage_explicite(): void
    {
        $service = ServiceMetier::factory()->create();
        $utilisateur = $this->utilisateurAvecRole(['service_metier_id' => $service->id]);
        $categorie = CategorieDocument::factory()->create(['service_metier_id' => $service->id]);
        $document = DocumentArchive::factory()->create([
            'categorie_id' => $categorie->id,
            'niveau_confidentialite' => 'CONFIDENTIEL',
        ]);

        $this->assertTrue((new VisibiliteDocumentService())->estVisiblePar($document, $utilisateur));
    }
}
