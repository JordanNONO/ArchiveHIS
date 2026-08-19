<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pai_objectifs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pai_dossier_id')->constrained('pai_dossiers')->onDelete('cascade');
            $table->string('description');
            $table->date('echeance');
            // "En retard" n'est jamais stocké — toujours recalculé (echeance passée
            // ET pas encore fait), pour ne jamais désynchroniser du jour courant.
            $table->boolean('fait')->default(false);
            $table->date('date_realisation')->nullable();
            $table->foreignId('realise_par_id')->nullable()->constrained('utilisateurs')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pai_objectifs');
    }
};
