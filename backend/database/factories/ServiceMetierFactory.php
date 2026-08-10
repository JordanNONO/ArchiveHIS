<?php

namespace Database\Factories;

use App\Models\ServiceMetier;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceMetierFactory extends Factory
{
    protected $model = ServiceMetier::class;

    public function definition(): array
    {
        $nom = fake()->unique()->word();

        return [
            'code_service' => strtoupper($nom),
            'nom_service' => ucfirst($nom),
        ];
    }
}
