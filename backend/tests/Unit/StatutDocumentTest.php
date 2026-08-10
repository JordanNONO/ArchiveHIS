<?php

namespace Tests\Unit;

use App\Enums\StatutDocument;
use PHPUnit\Framework\TestCase;

/**
 * Le circuit de validation documentaire (voir DocumentStatusService) : ARCHIVE
 * n'est volontairement joignable que depuis VALIDE_ET_TRAITE — on valide ou
 * on rejette d'abord, l'archivage n'arrive qu'ensuite. Ces règles ont déjà
 * changé une fois cette session ; ce test fige le contrat pour éviter qu'une
 * future modification du workflow ne le brise silencieusement.
 */
class StatutDocumentTest extends TestCase
{
    public function test_archive_est_seulement_joignable_depuis_valide_et_traite(): void
    {
        foreach (StatutDocument::cases() as $statut) {
            $peutArchiver = StatutDocument::peutTransitionerVers($statut->value, StatutDocument::ARCHIVE->value);

            if ($statut === StatutDocument::VALIDE_ET_TRAITE) {
                $this->assertTrue($peutArchiver, "VALIDE_ET_TRAITE devrait pouvoir transitionner vers ARCHIVE");
            } else {
                $this->assertFalse($peutArchiver, "{$statut->value} ne devrait pas pouvoir transitionner directement vers ARCHIVE");
            }
        }
    }

    public function test_soumis_peut_atteindre_la_decision_sans_passer_par_le_circuit_complet(): void
    {
        $this->assertTrue(StatutDocument::peutTransitionerVers(StatutDocument::SOUMIS->value, StatutDocument::VALIDE_ET_TRAITE->value));
        $this->assertTrue(StatutDocument::peutTransitionerVers(StatutDocument::SOUMIS->value, StatutDocument::INCOMPLET_REJETE->value));
    }

    public function test_rejete_repart_directement_vers_soumis(): void
    {
        $this->assertSame([StatutDocument::SOUMIS->value], StatutDocument::transitions()[StatutDocument::INCOMPLET_REJETE->value]);
    }

    public function test_expire_a_purger_est_un_statut_terminal(): void
    {
        $this->assertSame([], StatutDocument::transitions()[StatutDocument::EXPIRE_A_PURGER->value]);
    }

    public function test_transition_non_repertoriee_est_refusee(): void
    {
        $this->assertFalse(StatutDocument::peutTransitionerVers(StatutDocument::SOUMIS->value, StatutDocument::EXPIRE_A_PURGER->value));
    }

    /**
     * Regroupement utilisé pour les badges agrégés (voir StatutDocument::groupe()) —
     * un rejeté ou expiré doit toujours ressortir comme "attention", jamais comme "traité".
     */
    public function test_groupe_classe_correctement_chaque_statut(): void
    {
        $this->assertSame('attention', StatutDocument::INCOMPLET_REJETE->groupe());
        $this->assertSame('attention', StatutDocument::EXPIRE_A_PURGER->groupe());
        $this->assertSame('traite', StatutDocument::VALIDE_ET_TRAITE->groupe());
        $this->assertSame('traite', StatutDocument::ARCHIVE->groupe());
        $this->assertSame('en_cours', StatutDocument::SOUMIS->groupe());
        $this->assertSame('en_cours', StatutDocument::TRANSMIS_AU_SERVICE->groupe());
        $this->assertSame('en_cours', StatutDocument::EN_COURS_DE_TRAITEMENT->groupe());
    }

    /**
     * Côté externe (intervenant/bénéficiaire), VALIDE_ET_TRAITE/ARCHIVE/EXPIRE_A_PURGER
     * doivent tous se lire comme "Traité" — le circuit interne (archivage, purge) ne
     * concerne pas le déposant, voir StatutDocument::libelleExterne().
     */
    public function test_libelle_externe_simplifie_les_statuts_traites(): void
    {
        $this->assertSame('Traité', StatutDocument::VALIDE_ET_TRAITE->libelleExterne());
        $this->assertSame('Traité', StatutDocument::ARCHIVE->libelleExterne());
        $this->assertSame('Traité', StatutDocument::EXPIRE_A_PURGER->libelleExterne());
        $this->assertSame('À compléter', StatutDocument::INCOMPLET_REJETE->libelleExterne());
    }
}
