<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->foreignId('service_metier_id')->nullable()->after('message')
                ->constrained('services_metier')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropForeign(['service_metier_id']);
            $table->dropColumn('service_metier_id');
        });
    }
};
