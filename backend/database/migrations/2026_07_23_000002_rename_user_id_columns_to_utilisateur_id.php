<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tables portant une colonne user_id référençant les utilisateurs.
     *
     * @var string[]
     */
    private array $tables = ['personnels', 'role_user', 'consultations', 'shares', 'favorites', 'documents'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            DB::statement("ALTER TABLE {$table} CHANGE user_id utilisateur_id BIGINT UNSIGNED NOT NULL");
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            DB::statement("ALTER TABLE {$table} CHANGE utilisateur_id user_id BIGINT UNSIGNED NOT NULL");
        }
    }
};
