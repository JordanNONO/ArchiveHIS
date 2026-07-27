<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->foreignId('destinataire_utilisateur_id')->nullable()->after('utilisateur_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->string('email_destinataire')->nullable()->after('destinataire_utilisateur_id');
            $table->string('type_partage', 20)->default('interne')->after('email_destinataire');
            $table->text('message')->nullable()->after('type_partage');
        });
    }

    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropForeign(['destinataire_utilisateur_id']);
            $table->dropColumn(['destinataire_utilisateur_id', 'email_destinataire', 'type_partage', 'message']);
        });
    }
};
