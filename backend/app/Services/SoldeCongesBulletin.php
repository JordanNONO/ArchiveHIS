<?php

namespace App\Services;

use App\Models\DocumentArchive;

/**
 * Lit le solde de congés payés écrit sur un bulletin de paie — choix
 * explicite 2026-11-22 (« lu sur le bulletin » plutôt qu'une saisie RH).
 *
 * Source : `texte_extrait`, déjà rempli pour chaque document par l'analyse
 * IA / l'OCR (voir AnalyserDocumentIA, documents:analyser-ia-retroactif) —
 * aucune nouvelle dépendance de lecture PDF.
 *
 * La présentation des bulletins varie selon le logiciel de paie : on cherche
 * donc plusieurs formulations courantes et on préfère ne RIEN afficher
 * plutôt qu'un chiffre douteux (valeur hors 0–80 jours, aucune mention de
 * congés à proximité). Si le format réel n'est pas reconnu, c'est ici qu'il
 * faut ajouter son motif.
 */
class SoldeCongesBulletin
{
    private const NOMBRE = '(-?\d{1,3}(?:[.,]\d{1,2})?)';

    /** Motifs essayés dans l'ordre, du plus précis au plus large. */
    private static function motifs(): array
    {
        $n = self::NOMBRE;

        return [
            // « Solde congés payés : 18,50 » / « Solde CP 18,5 »
            "/solde\s*(?:de\s*)?(?:des\s*)?(?:cong[ée]s(?:\s*pay[ée]s)?|c\.?\s?p\.?)\b[^0-9\-]{0,40}{$n}/iu",
            // « Congés payés … Solde 18,50 » (tableau acquis / pris / solde)
            "/(?:cong[ée]s\s*pay[ée]s|\bc\.?\s?p\.?\b)[^\n]{0,120}?solde[^0-9\-]{0,20}{$n}/iu",
            // « Congés restant à prendre : 18,5 »
            "/cong[ée]s[^\n]{0,40}?rest(?:e|ant)s?\s*(?:à\s*prendre)?[^0-9\-]{0,20}{$n}/iu",
        ];
    }

    public static function lireTexte(?string $texte): ?float
    {
        if (!$texte) {
            return null;
        }

        // Espaces multiples / insécables écrasés : l'OCR découpe souvent une
        // même ligne en morceaux très espacés.
        $texte = preg_replace('/[\h\x{00A0}]+/u', ' ', $texte);

        foreach (self::motifs() as $motif) {
            if (preg_match($motif, $texte, $m)) {
                $valeur = (float) str_replace(',', '.', $m[1]);
                if ($valeur >= 0 && $valeur <= 80) {
                    return round($valeur, 2);
                }
            }
        }

        return null;
    }

    public static function lire(DocumentArchive $bulletin): ?float
    {
        return self::lireTexte($bulletin->texte_extrait);
    }
}
