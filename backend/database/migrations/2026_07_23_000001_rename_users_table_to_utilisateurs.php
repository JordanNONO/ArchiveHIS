<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('users', 'utilisateurs');
        // CHANGE plutôt que RENAME COLUMN : compatible avec les versions de
        // MariaDB/MySQL antérieures à celles supportant la syntaxe native.
        DB::statement('ALTER TABLE utilisateurs CHANGE name nom VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE utilisateurs CHANGE email mail VARCHAR(255) NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE utilisateurs CHANGE mail email VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE utilisateurs CHANGE nom name VARCHAR(255) NOT NULL');
        Schema::rename('utilisateurs', 'users');
    }
};
