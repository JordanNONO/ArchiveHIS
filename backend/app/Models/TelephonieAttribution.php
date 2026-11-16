<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Qui détient quoi, depuis quand. Une attribution n'est jamais modifiée pour
 * changer de détenteur : on la clôt et on en crée une autre (voir la
 * migration), ce qui préserve l'historique d'un numéro qui change de
 * téléphone.
 */
class TelephonieAttribution extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_attributions';

    public const ETATS_MATERIEL = ['neuf', 'bon', 'usage'];

    /**
     * "non_requise" : la reprise de l'existant. Ces téléphones sont déjà entre
     * les mains des salariés, réclamer une décharge rétroactive à dix-huit
     * personnes ferait abandonner la reprise avant la troisième ligne.
     */
    public const DECHARGE_STATUTS = ['non_requise', 'a_signer', 'signee', 'refusee'];

    protected $fillable = [
        'personnel_id',
        'salarie_nom',
        'appareil_id',
        'ligne_id',
        'date_remise',
        'etat_remise',
        'avec_chargeur',
        'avec_coque',
        'observations',
        'date_restitution',
        'etat_restitution',
        'observations_restitution',
        'decharge_statut',
        'decharge_document_id',
        'decharge_envoyee_le',
        'decharge_signee_le',
        'decharge_signataire_ip',
        'decharge_signataire_agent',
        'decharge_signature',
        'cree_par_id',
    ];

    protected $casts = [
        'date_remise' => 'date',
        'date_restitution' => 'date',
        'avec_chargeur' => 'boolean',
        'avec_coque' => 'boolean',
        'decharge_envoyee_le' => 'datetime',
        'decharge_signee_le' => 'datetime',
    ];

    /**
     * Le tracé de la signature est une preuve, pas une donnée d'affichage :
     * il ne part jamais dans une liste. La page de signature et le PDF le
     * lisent explicitement.
     */
    protected $hidden = ['decharge_signature'];

    public function personnel()
    {
        return $this->belongsTo(Personnels::class, 'personnel_id');
    }

    public function appareil()
    {
        return $this->belongsTo(TelephonieAppareil::class, 'appareil_id');
    }

    public function ligne()
    {
        return $this->belongsTo(TelephonieLigne::class, 'ligne_id');
    }

    public function dechargeDocument()
    {
        return $this->belongsTo(DocumentArchive::class, 'decharge_document_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    /** Ce qui est encore détenu aujourd'hui. */
    public function scopeEnCours($query)
    {
        return $query->whereNull('date_restitution');
    }

    public function estRestituee(): bool
    {
        return $this->date_restitution !== null;
    }

    /**
     * Le nom à afficher : la fiche du personnel quand elle existe, sinon le
     * nom écrit à la main (salarié supprimé du personnel, reprise de
     * l'existant sur quelqu'un qui n'a pas de fiche).
     */
    public function nomSalarie(): string
    {
        if ($this->personnel) {
            return trim("{$this->personnel->nom} {$this->personnel->prenom}");
        }

        return $this->salarie_nom ?: '—';
    }

    /**
     * Il n'existe PAS de "matériel à récupérer" calculable ici : `personnels`
     * ne porte aucune date de sortie, celle-ci vit dans la Fluctuation RH
     * (section `sortie`, nom du salarié en texte libre). Le rapprochement se
     * fait donc par nom normalisé, dans TelephonieAlertes — pas par un scope
     * Eloquent qui laisserait croire à une jointure propre.
     */
    public function scopeEnCoursAvecDetenteur($query)
    {
        return $query->enCours()->with(['personnel:id,nom,prenom', 'appareil', 'ligne']);
    }
}
