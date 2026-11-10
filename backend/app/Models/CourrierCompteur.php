<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Compteur dédié à la génération atomique des références de courrier (une
 * ligne par préfixe+mois, ex: "CRE-2610") — voir genererReference().
 * Table séparée plutôt qu'un count() sur document_archives : il doit
 * toujours y avoir une ligne à verrouiller (lockForUpdate()), y compris pour
 * le tout premier courrier du mois.
 */
class CourrierCompteur extends Model
{
    protected $table = 'courrier_compteurs';

    protected $fillable = ['cle', 'valeur'];

    /**
     * Reprend la méthode de référencement utilisée par le pôle administratif
     * avant HIS Archives (demande explicite, 2026-10-07) : CRE-260405 = le
     * 5e courrier ENTRANT du mois d'avril 2026, CRS-260405 = le 5e SORTANT du
     * même mois (les deux compteurs sont indépendants). La date de référence
     * est celle du courrier lui-même (date_reception pour un entrant,
     * date_envoi pour un sortant), pas la date d'archivage dans le logiciel.
     *
     * Incrémente ATOMIQUEMENT le compteur dédié — un simple count()+1 sur
     * document_archives pouvait donner la même référence à deux courriers
     * enregistrés presque en même temps. lockForUpdate() seul ne suffit pas
     * pour le tout premier courrier du mois (aucune ligne à verrouiller) : la
     * ligne est d'abord garantie exister (create, avec repli sur une relecture
     * verrouillée si une autre requête l'a créée entre-temps — la contrainte
     * unique sur `cle` fait échouer la création en double).
     *
     * Utilisée à la création (DocumentController::store()), quand la date
     * d'un courrier change de mois à la modification (update()), et par la
     * commande courriers:corriger-references.
     */
    public static function genererReference(string $sensCourrier, $date): string
    {
        $prefixe = $sensCourrier === 'entrant' ? 'CRE' : 'CRS';
        $anneeMois = ($date ? Carbon::parse($date) : now())->format('ym');
        $cle = "{$prefixe}-{$anneeMois}";

        $sequence = DB::transaction(function () use ($cle) {
            $compteur = self::where('cle', $cle)->lockForUpdate()->first();
            if (!$compteur) {
                try {
                    $compteur = self::create(['cle' => $cle, 'valeur' => 0]);
                } catch (\Illuminate\Database\QueryException $e) {
                    $compteur = self::where('cle', $cle)->lockForUpdate()->first();
                }
            }
            $compteur->increment('valeur');
            return $compteur->valeur;
        });

        return $cle . str_pad($sequence, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Vrai si la référence (format CRE-AAMMNN / CRS-AAMMNN) ne correspond plus
     * au mois de la date du courrier — cas d'une date corrigée après coup via
     * "Modifier" : la référence avait été calculée avec l'ancienne date.
     * Les références à l'ancien format aléatoire (CRE-MTLLYGTI0) et les
     * courriers sans date ne sont jamais considérés comme décalés.
     */
    public static function referenceDecalee(?string $reference, $date): bool
    {
        if (!$date || !$reference || !preg_match('/^(CRE|CRS)-(\d{4})\d{2,}$/', $reference, $m)) {
            return false;
        }
        return $m[2] !== Carbon::parse($date)->format('ym');
    }
}
