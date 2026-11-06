<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Fichier supplémentaire déposé en même temps qu'un document (ex: la lettre
 * d'un courrier + une pièce qui l'accompagnait) — distinct d'une
 * DocumentVersion, qui remplace le fichier principal plutôt que de s'y ajouter.
 */
class DocumentPieceJointe extends Model
{
    // Sans ça, Eloquent devine "document_piece_jointes" (seul "jointe" se met
    // au pluriel) au lieu de la vraie table "document_pieces_jointes" (voir la
    // migration create_document_pieces_jointes_table) — faisait échouer en 500
    // absolument tout accès aux pièces jointes, sur tous les documents.
    protected $table = 'document_pieces_jointes';

    /**
     * Ce que la pièce prouve. Une preuve de paiement et une facture ne jouent
     * pas le même rôle dans le traitement d'un courrier : le type est demandé
     * au moment où on joint le fichier, pas deviné à l'affichage. 'autre'
     * reste le repli, y compris pour les pièces déposées avant que ce champ
     * existe (voir la migration ajoute_type_et_auteur_aux_pieces_jointes).
     */
    public const TYPES = ['paiement', 'recu', 'facture', 'courrier', 'autre'];

    protected $fillable = [
        'document_archive_id',
        'nom_fichier_original',
        'type_piece',
        'ajoute_par_utilisateur_id',
        'chemin_stockage_serveur',
        'format_mime',
        'taille',
    ];

    public function document()
    {
        return $this->belongsTo(DocumentArchive::class, 'document_archive_id');
    }

    public function ajoutePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'ajoute_par_utilisateur_id');
    }
}
