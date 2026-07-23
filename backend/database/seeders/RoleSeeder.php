<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        Role::create([
            'label' => 'Administrator',
            'acreditation' => 'Full Access',
        ]);

        Role::create([
            'label' => 'Editor',
            'acreditation' => 'Edit Access',
        ]);

        Role::create([
            'label' => 'Viewer',
            'acreditation' => 'View Only',
        ]);

        // Add more roles as needed
    }
}
