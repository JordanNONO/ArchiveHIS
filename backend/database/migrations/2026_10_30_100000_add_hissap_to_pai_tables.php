<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pai_dossiers', function (Blueprint $table) {
            // Lien vers le client HisSAP — la clé de synchro : HisSAP peut créer
            // une nouvelle ligne pai pour le même client, c'est toujours le même
            // dossier ici (jamais de doublon).
            $table->unsignedInteger('hissap_client_id')->nullable()->unique()->after('cree_par_id');
            // Dernière ligne pai HisSAP reçue pour ce client.
            $table->unsignedInteger('hissap_pai_id')->nullable()->after('hissap_client_id');
            // Contenu du PAI HisSAP (bénéficiaire, tuteur, consignes, et santé si
            // demandée) — chiffré : il contient des données personnelles.
            $table->longText('donnees_hissap')->nullable()->after('hissap_pai_id');
            // Empreinte du contenu reçu : permet de savoir si le PAI a changé
            // dans HisSAP depuis la dernière synchro (HisSAP ne date pas ses
            // modifications).
            $table->string('hissap_empreinte', 64)->nullable()->after('donnees_hissap');
            $table->timestamp('synchronise_le')->nullable()->after('hissap_empreinte');
        });

        Schema::table('pai_objectifs', function (Blueprint $table) {
            // Objectif créé à partir des "objectifs de soins" HisSAP : une
            // resynchro ajoute les nouveaux, sans jamais toucher à ceux-là.
            $table->boolean('issu_de_hissap')->default(false)->after('pai_dossier_id');
        });
    }

    public function down(): void
    {
        Schema::table('pai_objectifs', function (Blueprint $table) {
            $table->dropColumn('issu_de_hissap');
        });

        Schema::table('pai_dossiers', function (Blueprint $table) {
            $table->dropUnique(['hissap_client_id']);
            $table->dropColumn(['hissap_client_id', 'hissap_pai_id', 'donnees_hissap', 'hissap_empreinte', 'synchronise_le']);
        });
    }
};
