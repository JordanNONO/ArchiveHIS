<?php

namespace Database\Factories;

use App\Models\CategorieDocument;
use App\Models\TypeDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

class TypeDocumentFactory extends Factory
{
    protected $model = TypeDocument::class;

    public function definition(): array
    {
        $libelle = fake()->unique()->word();

        return [
            'categorie_id' => CategorieDocument::factory(),
            'parent_id' => null,
            'libelle' => ucfirst($libelle),
            'code' => strtoupper($libelle),
        ];
    }
}
