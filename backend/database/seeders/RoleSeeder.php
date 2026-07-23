<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\RoleUsers;
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
        $administrator = RoleUsers::create([
            'nom' => 'Administrator',
            'code_role' => 'ADMIN',
            'acreditation' => 'Full Access',
        ]);
        $administrator->permissions()->sync(Permission::pluck('id'));

        $editor = RoleUsers::create([
            'nom' => 'Editor',
            'code_role' => 'EDITOR',
            'acreditation' => 'Edit Access',
        ]);
        $editor->permissions()->sync(
            Permission::whereIn('code_perm', ['creer_documents', 'valider_documents', 'consulter_archives'])->pluck('id')
        );

        $viewer = RoleUsers::create([
            'nom' => 'Viewer',
            'code_role' => 'VIEWER',
            'acreditation' => 'View Only',
        ]);
        $viewer->permissions()->sync(
            Permission::where('code_perm', 'consulter_archives')->pluck('id')
        );

        // Add more roles as needed
    }
}
