<?php

namespace Tests\Feature;

use App\Models\RoleUsers;
use App\Models\ServiceMetier;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Régression directe du bug de cette session : un ancien seed (d'avant le
 * cloisonnement par service) avait laissé le rôle "Administrator" avec un
 * service_metier_id non nul en base. RoleSeeder utilisait firstOrCreate, qui
 * ne touche jamais une ligne déjà existante — la valeur fautive restait donc
 * indéfiniment, même après un nouveau déploiement du seeder. Corrigé via
 * updateOrCreate + service_metier_id forcé à null.
 */
class RoleSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_et_editor_restent_transverses_meme_apres_une_valeur_erronee_existante(): void
    {
        (new PermissionSeeder())->run();

        $serviceFautif = ServiceMetier::factory()->create();
        // Simule l'état constaté en production : une ligne déjà présente,
        // avec une valeur qui n'aurait jamais dû s'y trouver.
        RoleUsers::create([
            'nom' => 'Administrator',
            'code_role' => 'ADMIN',
            'acreditation' => 'Full Access',
            'service_metier_id' => $serviceFautif->id,
        ]);

        (new RoleSeeder())->run();

        $administrator = RoleUsers::where('code_role', 'ADMIN')->firstOrFail();
        $this->assertNull($administrator->service_metier_id, 'Administrator doit rester transverse (tous services) après le seed');

        $editor = RoleUsers::where('code_role', 'EDITOR')->firstOrFail();
        $this->assertNull($editor->service_metier_id, 'Editor doit rester transverse (tous services) après le seed');
    }

    public function test_un_role_editeur_par_service_metier_est_cree_pour_chaque_service(): void
    {
        (new PermissionSeeder())->run();
        $service = ServiceMetier::factory()->create(['code_service' => 'RH']);

        (new RoleSeeder())->run();

        $this->assertDatabaseHas('roles', [
            'code_role' => 'EDITOR_RH',
            'service_metier_id' => $service->id,
        ]);
    }
}
