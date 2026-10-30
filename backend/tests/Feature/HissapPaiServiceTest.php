<?php

namespace Tests\Feature;

use App\Http\Controllers\PaiController;
use App\Models\CategorieDocument;
use App\Models\PaiDossier;
use App\Models\Utilisateurs;
use App\Services\HissapPaiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HissapPaiServiceTest extends TestCase
{
    use RefreshDatabase;

    private function pai(array $surcharges = []): array
    {
        return array_replace_recursive([
            'id' => 12,
            'client_id' => 40,
            'cree_le' => '2026-09-01 10:00:00',
            'publie_le' => '2026-09-02',
            'realise_le' => null,
            'beneficiaire' => ['nom' => 'Martin', 'prenom' => 'Jeanne', 'date_naissance' => '1940-01-01', 'telephone' => '0102030405', 'adresse' => '1 rue X, 75001 Paris'],
            'sante' => ['pathologie' => 'Diabète', 'traitement' => null, 'medecin' => 'Dr Y', 'historique_pathologie' => null],
            'tuteur' => ['nom' => 'Martin', 'prenom' => 'Paul', 'lien' => 'Fils', 'telephone' => null, 'telephone_fixe' => null, 'email' => null, 'adresse' => null],
            'responsable_secteur' => ['email' => 'rs@exemple.fr', 'nom' => 'Rita S'],
            'objectifs_de_soins' => '<p>- Maintenir l&#39;autonomie</p><p>2) Sorties accompagnées</p>',
            'consignes' => ['remise_de_cle' => '<p>Boîte à clés</p>', 'moyens' => ''],
        ], $surcharges);
    }

    private function preparer(): Utilisateurs
    {
        config(['services.hissap.url' => 'https://hissap.test', 'services.hissap.api_key' => 'cle']);
        CategorieDocument::factory()->create(['libelle_cat' => PaiController::LIBELLE_CATEGORIE_DEFAUT]);
        return Utilisateurs::factory()->create();
    }

    public function test_import_cree_le_dossier_avec_ses_objectifs_et_retrouve_le_responsable(): void
    {
        $importeur = $this->preparer();
        $rs = Utilisateurs::factory()->create(['mail' => 'RS@exemple.fr']);

        $dossier = app(HissapPaiService::class)->importer($this->pai(), $importeur, ['mois_echeance' => 3]);

        $this->assertSame('PAI — Jeanne Martin', $dossier->titre);
        $this->assertSame($rs->id, $dossier->responsable_secteur_id);
        $this->assertSame(40, $dossier->hissap_client_id);
        $this->assertSame(["Maintenir l'autonomie", 'Sorties accompagnées'], $dossier->objectifs->pluck('description')->all());
        $this->assertSame('2026-12-02', $dossier->objectifs->first()->echeance->toDateString());
        $this->assertSame('Boîte à clés', $dossier->donnees_hissap['consignes']['remise_de_cle']);
        $this->assertArrayNotHasKey('moyens', $dossier->donnees_hissap['consignes']);
        $this->assertNull($dossier->donnees_hissap['sante'], 'santé non importée sans demande explicite');
    }

    public function test_resynchro_ajoute_les_nouveaux_objectifs_sans_toucher_aux_existants(): void
    {
        $importeur = $this->preparer();
        $service = app(HissapPaiService::class);
        $dossier = $service->importer($this->pai(), $importeur, ['donnees_sante' => true]);
        $dossier->objectifs()->first()->update(['fait' => true]);
        $dossier->update(['titre' => 'Titre changé dans HisDocs']);

        $modifie = $this->pai(['id' => 13, 'objectifs_de_soins' => "<p>- Maintenir l'autonomie</p><p>Sorties accompagnées</p><p>Nouvel objectif</p>"]);
        $this->assertSame('modifie', $service->statut($modifie, $dossier->fresh()));

        $dossier = $service->importer($modifie, $importeur);

        $this->assertSame(1, PaiDossier::count(), 'jamais de doublon pour un même client');
        $this->assertSame('Titre changé dans HisDocs', $dossier->titre);
        $this->assertSame(13, $dossier->hissap_pai_id);
        $this->assertCount(3, $dossier->objectifs);
        $this->assertTrue($dossier->objectifs->firstWhere('description', "Maintenir l'autonomie")->fait);
        $this->assertSame('Diabète', $dossier->donnees_hissap['sante']['pathologie'], 'le choix santé fait à l\'import est gardé');
        $this->assertSame('a_jour', $service->statut($modifie, $dossier));
    }

    public function test_recuperation_envoie_la_cle_api(): void
    {
        $this->preparer();
        Http::fake(['hissap.test/*' => Http::response(['pais' => [$this->pai()], 'success' => true])]);

        $pais = app(HissapPaiService::class)->recupererTous();

        $this->assertCount(1, $pais);
        Http::assertSent(fn ($r) => $r->hasHeader('X-API-Key', 'cle') && str_contains($r->url(), '/hisdocs_pai.php'));
    }

    public function test_recuperation_signale_une_cle_refusee(): void
    {
        $this->preparer();
        Http::fake(['hissap.test/*' => Http::response(['message' => 'Non autorisé'], 401)]);

        $this->expectExceptionMessage('HisSAP refuse la clé API');
        app(HissapPaiService::class)->recupererTous();
    }
}
