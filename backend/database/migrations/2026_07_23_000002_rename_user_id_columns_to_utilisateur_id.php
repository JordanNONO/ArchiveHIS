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
            DB::statement("ALTER TABLE {$table} RENAME COLUMN user_id TO utilisateur_id");
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            DB::statement("ALTER TABLE {$table} RENAME COLUMN utilisateur_id TO user_id");
        }
    }
};
