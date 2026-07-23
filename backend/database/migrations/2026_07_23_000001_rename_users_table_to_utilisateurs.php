<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('users', 'utilisateurs');
        DB::statement('ALTER TABLE utilisateurs RENAME COLUMN name TO nom');
        DB::statement('ALTER TABLE utilisateurs RENAME COLUMN email TO mail');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE utilisateurs RENAME COLUMN mail TO email');
        DB::statement('ALTER TABLE utilisateurs RENAME COLUMN nom TO name');
        Schema::rename('utilisateurs', 'users');
    }
};
