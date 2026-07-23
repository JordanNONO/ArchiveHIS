<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historique_statuts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_archive_id')->constrained('document_archives')->onDelete('cascade');
            $table->string('ancien_statut')->nullable();
            $table->string('nouveau_statut');
            $table->timestamp('date_changement')->useCurrent();
            $table->text('motif_changement')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historique_statuts');
    }
};
