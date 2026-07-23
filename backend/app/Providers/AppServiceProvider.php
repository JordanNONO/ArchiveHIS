<?php

namespace App\Providers;

use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Alias stables pour les relations polymorphiques (shares/favorites),
        // indépendants du nom de classe réel des modèles.
        Relation::enforceMorphMap([
            'document' => DocumentArchive::class,
            'categorie' => CategorieDocument::class,
        ]);
    }
}
