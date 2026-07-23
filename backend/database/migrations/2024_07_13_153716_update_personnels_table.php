<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->string('sexe')->nullable();
            $table->date('date_naissance')->nullable();
            $table->string('lieu_naissance')->nullable();
            $table->string('statut_mat')->nullable();
            $table->string('lieu_residence')->nullable();
            $table->string('first_phone')->nullable();
            $table->string('second_phone')->nullable();
            $table->string('cni')->nullable();
            $table->string('photo')->nullable();
            $table->string('lang')->nullable();
            $table->text('bibliographie')->nullable();
            $table->integer('nb_enfant')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->dropColumn([
                'sexe',
                'date_naissance',
                'lieu_naissance',
                'statut_mat',
                'lieu_residence',
                'first_phone',
                'second_phone',
                'cni',
                'photo',
                'lang',
                'bibliographie',
                'nb_enfant',
            ]);
        });
    }
};
