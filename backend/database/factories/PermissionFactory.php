<?php

namespace Database\Factories;

use App\Models\Permission;
use Illuminate\Database\Eloquent\Factories\Factory;

class PermissionFactory extends Factory
{
    protected $model = Permission::class;

    public function definition(): array
    {
        $code = fake()->unique()->word();

        return [
            'code_perm' => $code,
            'label_perm' => ucfirst($code),
        ];
    }
}
