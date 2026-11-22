<?php

namespace Tests\Unit;

use App\Models\DocumentArchive;
use App\Services\EcheancesDocuments;
use App\Services\SoldeCongesBulletin;
use PHPUnit\Framework\TestCase;

class MesPapiersTest extends TestCase
{
    public function test_solde_lu_sur_plusieurs_formats_de_bulletin(): void
    {
        $this->assertSame(18.5, SoldeCongesBulletin::lireTexte('Solde congés payés : 18,50 jours'));
        $this->assertSame(12.0, SoldeCongesBulletin::lireTexte("Solde CP   12"));
        $this->assertSame(7.5, SoldeCongesBulletin::lireTexte('Congés payés  Acquis 25,00  Pris 17,50  Solde 7,50'));
        $this->assertSame(9.0, SoldeCongesBulletin::lireTexte('Congés restant à prendre : 9'));
    }

    public function test_aucun_solde_plutot_quun_chiffre_douteux(): void
    {
        $this->assertNull(SoldeCongesBulletin::lireTexte(null));
        $this->assertNull(SoldeCongesBulletin::lireTexte('Net à payer 1 523,40'));
        $this->assertNull(SoldeCongesBulletin::lireTexte('Solde congés payés : 450'));
    }

    public function test_paliers_de_rappel(): void
    {
        $this->assertNull(EcheancesDocuments::palierAtteint(90));
        $this->assertSame(60, EcheancesDocuments::palierAtteint(53));
        $this->assertSame(30, EcheancesDocuments::palierAtteint(30));
        $this->assertSame(7, EcheancesDocuments::palierAtteint(3));
        $this->assertSame(0, EcheancesDocuments::palierAtteint(0));
        $this->assertSame(0, EcheancesDocuments::palierAtteint(-4));
    }

    private static function doc(string $titre): DocumentArchive
    {
        return (new DocumentArchive(['titre_document' => $titre]))->setRelation('typeDocument', null);
    }

    public function test_famille_reconnue_depuis_le_titre(): void
    {
        $this->assertSame('titre-sejour', EcheancesDocuments::famille(self::doc('Nouveau titre de séjour')));
        $this->assertSame('visite-medicale', EcheancesDocuments::famille(self::doc("Visite médicale d'embauche")));
        $this->assertSame('psc1', EcheancesDocuments::famille(self::doc('Attestation PSC1')));
        $this->assertNull(EcheancesDocuments::famille(self::doc('Carte de mutuelle 2026')));
    }
}
