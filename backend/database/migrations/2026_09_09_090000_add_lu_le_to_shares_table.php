<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->timestamp('lu_le')->nullable()->after('dernier_acces_le');
        });

        // Les partages déjà existants avant ce correctif ne doivent pas
        // apparaître comme "non lus" du jour au lendemain — on les considère
        // déjà vus (marqués lus à leur propre date de création), seuls les
        // nouveaux partages à partir de maintenant commencent réellement non lus.
        DB::table('shares')->whereNull('lu_le')->update(['lu_le' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropColumn('lu_le');
        });
    }
};
