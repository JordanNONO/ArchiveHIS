<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE roles CHANGE label nom VARCHAR(255) NOT NULL');

        Schema::table('roles', function (Blueprint $table) {
            $table->string('code_role', 100)->nullable()->unique()->after('nom');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('code_role');
        });

        DB::statement('ALTER TABLE roles CHANGE nom label VARCHAR(255) NOT NULL');
    }
};
