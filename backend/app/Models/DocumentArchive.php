<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class DocumentArchive extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'document_archives';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'utilisateur_id',
        'personnel_concerne_id',
        'nom_personne_concernee',
        'categorie_id',
        'type_document_id',
        'titre_document',
        'auteur',
        'format_mime',
        'resume',
        'objet',
        'texte_extrait',
        'code_reference',
        'status_doc',
        'date_limite_correction',
        'relance_correction_envoyee_le',
        'echeance_traitement_le',
        'nom_fichier_original',
        'chemin_stockage_serveur',
        'taille',
        'file_create_date',
        'date_archivage',
        'duree_conservation_annees',
        'niveau_confidentialite',
        'checksum_sha256',
        'verrouille_par_utilisateur_id',
        'verrouille_le',
        'version_majeure',
        'version_mineure',
        'sens_courrier',
        'type_envoi',
        'numero_recommande',
        'nombre_documents',
        'date_envoi',
        'date_reception',
        'expediteur_nom',
        'expediteur_adresse',
        'destinataire_nom',
        'destinataire_adresse',
        'montant',
        'etat_courrier',
        'deadline_courrier',
        'rappel_courrier_envoye_le',
    ];

    protected $casts = [
        'verrouille_le' => 'datetime',
        'echeance_traitement_le' => 'date',
        'date_envoi' => 'date',
        'date_reception' => 'date',
        'deadline_courrier' => 'date',
        'rappel_courrier_envoye_le' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        // texte_recherche est un champ dérivé (jamais saisi directement, pas
        // dans $fillable) : recalculé à chaque sauvegarde à partir des champs
        // affichés, voir normaliserTexteRecherche() pour pourquoi c'est
        // nécessaire en plus d'indexer directement titre_document/etc.
        static::saving(function (DocumentArchive $document) {
            $document->texte_recherche = self::normaliserTexteRecherche(
                $document->titre_document,
                $document->resume,
                $document->objet,
                $document->texte_extrait,
                $document->code_reference,
            );
        });
    }

    /**
     * Le parseur FULLTEXT par défaut de MySQL ne coupe pas les mots sur '_'
     * (voir la migration document_archives_fulltext) — les titres/références
     * de ce projet étant massivement en snake_case/kebab-case (ex:
     * "PRO-RH-013_Reporting_RH_Mensuel_HIS"), une recherche sur "Reporting"
     * ne trouverait sinon jamais rien : tout resterait fusionné en un seul
     * token. On remplace donc '_'/'-' par des espaces avant indexation,
     * uniquement dans ce champ dérivé — jamais dans les champs affichés.
     */
    public static function normaliserTexteRecherche(?string ...$champs): string
    {
        $texte = implode(' ', array_filter($champs, fn ($v) => $v !== null && $v !== ''));
        return trim(str_replace(['_', '-'], ' ', $texte));
    }

    /**
     * Combien de temps un verrou reste actif sans action — au-delà, on le
     * considère expiré (oubli, session fermée...) plutôt que bloqué pour de bon.
     */
    private const VERROU_DUREE_MINUTES = 30;

    /**
     * Utilisateur ayant posé le verrou en cours (voir DocumentController::verrouiller()).
     */
    public function verrouillePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'verrouille_par_utilisateur_id');
    }

    /**
     * Verrou actif = posé et pas encore expiré. Un verrou expiré est traité
     * comme "libre" sans qu'il soit nécessaire de le nettoyer explicitement.
     */
    public function estVerrouille(): bool
    {
        if (!$this->verrouille_le) {
            return false;
        }

        return $this->verrouille_le->gt(now()->subMinutes(self::VERROU_DUREE_MINUTES));
    }

    /**
     * "2.3" — label lisible de la version courante du fichier.
     */
    public function getLabelVersionAttribute(): string
    {
        return "{$this->version_majeure}.{$this->version_mineure}";
    }

    /**
     * Get the user that owns the document.
     */
    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    /**
     * Get the category that owns the document.
     */
    public function categorieDocument()
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_id');
    }

    public function typeDocument()
    {
        return $this->belongsTo(TypeDocument::class, 'type_document_id');
    }

    /**
     * Le salarié concerné par le document (ex: le titulaire d'un CV, d'un contrat...),
     * distinct de l'utilisateur qui l'a téléversé (souvent un RH). Peut être absent
     * du système (candidat non encore embauché) — voir nom_personne_concernee.
     */
    public function personnelConcerne()
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    /**
     * Nom à afficher pour la personne concernée : la fiche Personnel liée si elle
     * existe, sinon le nom libre saisi (ex: candidat sans compte).
     */
    public function getNomConcerneAttribute(): ?string
    {
        if ($this->personnelConcerne) {
            return trim("{$this->personnelConcerne->prenom} {$this->personnelConcerne->nom}");
        }

        return $this->nom_personne_concernee;
    }

    /**
     * Composition : l'historique de statut appartient au document (supprimer le document supprime son historique).
     */
    public function historiqueStatuts()
    {
        return $this->hasMany(HistoriqueStatut::class, 'document_archive_id')->orderBy('date_changement');
    }

    /**
     * Anciennes versions du fichier (avant chaque remplacement), les plus récentes
     * en premier.
     */
    public function versions()
    {
        return $this->hasMany(DocumentVersion::class, 'document_archive_id')->orderByDesc('numero_version');
    }

    public function shares()
    {
        return $this->morphMany(Share::class, 'shareable');
    }

    public function favorites()
    {
        return $this->morphMany(Favorite::class, 'favoritable');
    }

    /**
     * Suivis de délai déclenchés par ce document (ex: la lettre de démission qui
     * ouvre une procédure de sortie) — voir SuiviDelai.
     */
    public function suivisDelais()
    {
        return $this->hasMany(SuiviDelai::class, 'document_declencheur_id');
    }

    /**
     * Suivi de délai actuellement en cours (non clôturé), pour afficher le niveau
     * d'alerte (vert/orange/rouge) sur la fiche/carte du document sans requête
     * séparée. Un document n'a jamais qu'un seul suivi actif à la fois.
     */
    public function suiviDelaiActif()
    {
        return $this->hasOne(SuiviDelai::class, 'document_declencheur_id')->whereNull('termine_le');
    }

    public function lireFichier(): string
    {
        return Storage::disk(config('filesystems.document_disk'))->get($this->chemin_stockage_serveur);
    }

    public function verifierIntegrite(): bool
    {
        if (!$this->checksum_sha256) {
            return false;
        }

        try {
            if (!Storage::disk(config('filesystems.document_disk'))->exists($this->chemin_stockage_serveur)) {
                return false;
            }

            return hash('sha256', $this->lireFichier()) === $this->checksum_sha256;
        } catch (\Throwable $e) {
            report($e);
            return false;
        }
    }
}
