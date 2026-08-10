<?php

namespace Database\Factories;

use App\Models\Utilisateurs;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UtilisateursFactory extends Factory
{
    protected $model = Utilisateurs::class;

    public function definition(): array
    {
        return [
            'nom' => fake()->name(),
            'mail' => fake()->unique()->safeEmail(),
            'password' => bcrypt('password'),
            'remember_token' => Str::random(10),
        ];
    }
}
