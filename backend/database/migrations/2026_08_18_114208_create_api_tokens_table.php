<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jetons d'API à portée large — pensés pour un agent externe (automatisation,
 * traitement de données), pas un compte humain : authentification par en-tête
 * `X-Api-Key` (voir AuthPersonnelMiddleware), résolue vers un compte de
 * service dédié qui porte le rôle Administrator, donc un accès complet aux
 * données via exactement les mêmes règles déjà en place pour un vrai
 * administrateur (VisibiliteDocumentService, CheckPermissionMiddleware...) —
 * aucune logique de contournement séparée à maintenir.
 *
 * Seul le hash SHA-256 du jeton est stocké (jamais le jeton en clair) — voir
 * ApiTokenController::store(), qui l'affiche une seule fois à la création.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            // Préfixe affiché dans la liste pour identifier un jeton sans jamais
            // pouvoir en reconstituer le secret (ex: "sk_a1b2c3d4…").
            $table->string('prefixe', 12);
            $table->string('jeton_hash', 64)->unique();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->foreignId('cree_par_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->timestamp('dernier_utilise_le')->nullable();
            $table->timestamp('revoque_le')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_tokens');
    }
};
