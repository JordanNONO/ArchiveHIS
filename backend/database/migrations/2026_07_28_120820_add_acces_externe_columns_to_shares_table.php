<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Support d'un accès externe sécurisé par lien + code à usage unique (OTP) pour
     * les partages par email (avocats, experts-comptables...) : le tiers ne reçoit
     * plus le fichier en pièce jointe, mais un lien vers un espace de consultation
     * dédié, qui exige un code envoyé par email avant de laisser voir/télécharger
     * quoi que ce soit.
     */
    public function up(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->string('token', 64)->nullable()->unique()->after('permissions');
            $table->timestamp('lien_expire_le')->nullable()->after('token');
            $table->string('otp_code_hash')->nullable()->after('lien_expire_le');
            $table->timestamp('otp_expire_le')->nullable()->after('otp_code_hash');
            $table->unsignedTinyInteger('otp_tentatives')->default(0)->after('otp_expire_le');
            $table->timestamp('otp_dernier_envoi_le')->nullable()->after('otp_tentatives');
            $table->string('session_token')->nullable()->after('otp_dernier_envoi_le');
            $table->timestamp('session_expire_le')->nullable()->after('session_token');
            $table->timestamp('dernier_acces_le')->nullable()->after('session_expire_le');
        });
    }

    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropColumn([
                'token',
                'lien_expire_le',
                'otp_code_hash',
                'otp_expire_le',
                'otp_tentatives',
                'otp_dernier_envoi_le',
                'session_token',
                'session_expire_le',
                'dernier_acces_le',
            ]);
        });
    }
};
