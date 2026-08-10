<?php

namespace Database\Factories;

use App\Models\RoleUsers;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoleUsersFactory extends Factory
{
    protected $model = RoleUsers::class;

    public function definition(): array
    {
        $nom = fake()->unique()->jobTitle();

        return [
            'nom' => $nom,
            'code_role' => strtoupper(str_replace(' ', '_', $nom)),
            'acreditation' => 'Edit Access',
            'service_metier_id' => null,
        ];
    }
}
