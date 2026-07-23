<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->foreignId('service_metier_id')
                ->nullable()
                ->after('code_role')
                ->constrained('services_metier')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropForeign(['service_metier_id']);
            $table->dropColumn('service_metier_id');
        });
    }
};
