<?php

namespace Tests\Unit;

use App\Models\CategorieDocument;
use App\Models\Utilisateurs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * estVerrouille() est le point de vérité utilisé par tous les gardes du
 * "gel" d'un dossier (CategorieController::update/destroy, DocumentController::store,
 * TypeDocumentController::store/update/destroy) — le figer ici évite qu'un de
 * ces gardes diverge silencieusement de la définition du verrouillage.
 */
class CategorieDocumentVerrouillageTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_dossier_fraichement_cree_nest_pas_verrouille(): void
    {
        $categorie = CategorieDocument::factory()->create();

        $this->assertFalse($categorie->estVerrouille());
    }

    public function test_verrouiller_puis_deverrouiller_change_bien_letat(): void
    {
        $categorie = CategorieDocument::factory()->create();
        $utilisateur = Utilisateurs::factory()->create();

        $categorie->update(['verrouille_par_utilisateur_id' => $utilisateur->id, 'verrouille_le' => now()]);
        $this->assertTrue($categorie->fresh()->estVerrouille());

        $categorie->update(['verrouille_par_utilisateur_id' => null, 'verrouille_le' => null]);
        $this->assertFalse($categorie->fresh()->estVerrouille());
    }
}
