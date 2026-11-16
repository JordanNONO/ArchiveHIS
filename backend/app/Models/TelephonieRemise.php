<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * L'événement « on confie ceci à quelqu'un ce jour-là », et la décharge qu'il
 * signe. Les objets confiés sont les détentions ouvertes par cette remise
 * (voir TelephonieDetention).
 */
class TelephonieRemise extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_remises';

    public const DECHARGE_STATUTS = ['non_requise', 'a_signer', 'signee', 'refusee'];

    protected $fillable = [
        'personnel_id',
        'salarie_nom',
        'date_remise',
        'avec_chargeur',
        'avec_coque',
        'observations',
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
        'avec_chargeur' => 'boolean',
        'avec_coque' => 'boolean',
        'decharge_envoyee_le' => 'datetime',
        'decharge_signee_le' => 'datetime',
    ];

    /**
     * Le tracé de la signature est une preuve, pas une donnée d'affichage :
     * il ne part jamais dans une liste. La page de signature et le générateur
     * de PDF le lisent explicitement.
     */
    protected $hidden = ['decharge_signature'];

    public function personnel()
    {
        return $this->belongsTo(Personnels::class, 'personnel_id');
    }

    public function detentions()
    {
        return $this->hasMany(TelephonieDetention::class, 'remise_id');
    }

    public function dechargeDocument()
    {
        return $this->belongsTo(DocumentArchive::class, 'decharge_document_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    public function scopeADecharger($query)
    {
        return $query->where('decharge_statut', 'a_signer');
    }

    public function nomSalarie(): string
    {
        if ($this->personnel) {
            return trim("{$this->personnel->nom} {$this->personnel->prenom}");
        }

        return $this->salarie_nom ?: '—';
    }

    /**
     * Enregistre la signature et ce qui la rend opposable. Le tracé seul ne
     * vaut rien : c'est l'ensemble horodatage + origine + document archivé qui
     * permet de soutenir plus tard que cette personne a bien reçu ce matériel.
     */
    public function enregistrerSignature(string $trace, ?string $ip, ?string $agent): void
    {
        $this->forceFill([
            'decharge_statut' => 'signee',
            'decharge_signature' => $trace,
            'decharge_signee_le' => now(),
            'decharge_signataire_ip' => $ip,
            'decharge_signataire_agent' => $agent ? mb_substr($agent, 0, 255) : null,
        ])->save();
    }
}
