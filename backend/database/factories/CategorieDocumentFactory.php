<?php

namespace Database\Factories;

use App\Models\CategorieDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

class CategorieDocumentFactory extends Factory
{
    protected $model = CategorieDocument::class;

    public function definition(): array
    {
        $libelle = fake()->unique()->word();

        return [
            'libelle_cat' => ucfirst($libelle),
            'code' => strtoupper($libelle),
            'service_metier_id' => null,
        ];
    }
}
