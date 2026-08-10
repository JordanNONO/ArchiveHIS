<?php

namespace Database\Factories;

use App\Enums\StatutDocument;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\Utilisateurs;
use Illuminate\Database\Eloquent\Factories\Factory;

class DocumentArchiveFactory extends Factory
{
    protected $model = DocumentArchive::class;

    public function definition(): array
    {
        return [
            'utilisateur_id' => Utilisateurs::factory(),
            'categorie_id' => CategorieDocument::factory(),
            'type_document_id' => null,
            'titre_document' => fake()->sentence(3),
            'auteur' => fake()->name(),
            'format_mime' => 'application/pdf',
            'resume' => fake()->sentence(),
            'code_reference' => fake()->unique()->bothify('REF-####??'),
            'status_doc' => StatutDocument::SOUMIS->value,
            'chemin_stockage_serveur' => 'documents/' . fake()->uuid() . '.pdf',
            'taille' => fake()->numberBetween(10_000, 500_000),
        ];
    }
}
