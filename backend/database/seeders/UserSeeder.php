<?php

namespace Database\Seeders;

use App\Models\Bureaux;
use App\Models\Personnels;
use App\Models\RoleUsers;
use App\Models\Utilisateurs;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $admin = Utilisateurs::create([
            'nom' => 'John Doe',
            'mail' => 'admin@sige.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'), // Use Hash::make to hash the password
            'remember_token' => null,
        ]);

        $adminRole = RoleUsers::where('code_role', 'ADMIN')->first();
        if ($adminRole) {
            $admin->roles()->attach($adminRole->id);
        }

        // Un Personnels est requis pour que /auth/me fonctionne (voir AuthController::me()).
        $bureau = Bureaux::firstOrCreate(['name' => 'Siège HIS']);
        Personnels::create([
            'utilisateur_id' => $admin->id,
            'bureau_id' => $bureau->id,
            'nom' => 'Doe',
            'prenom' => 'John',
        ]);
    }
}
