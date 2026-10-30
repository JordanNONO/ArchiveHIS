<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pai_dossiers', function (Blueprint $table) {
            // Protocole de prise en charge rédigé en interne à l'ouverture du
            // dossier (identité détaillée, programme de la journée, procédures,
            // objectifs, instructions, dispositif) — distinct de donnees_hissap
            // (importé tel quel depuis HisSAP) : ici c'est HisDocs qui est la
            // source, propre à chaque bénéficiaire, voir ProtocolePai.jsx.
            // Chiffré comme donnees_hissap : contient potentiellement des
            // informations de santé/vie privée.
            $table->longText('protocole')->nullable()->after('donnees_hissap');
            $table->timestamp('protocole_maj_le')->nullable()->after('protocole');
            $table->foreignId('protocole_maj_par_id')->nullable()->after('protocole_maj_le')->constrained('utilisateurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pai_dossiers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('protocole_maj_par_id');
            $table->dropColumn(['protocole', 'protocole_maj_le']);
        });
    }
};
