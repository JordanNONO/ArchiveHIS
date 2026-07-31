<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceMetier extends Model
{
    use HasFactory;

    protected $table = 'services_metier';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'code_service',
        'nom_service',
    ];

    public function roles()
    {
        return $this->hasMany(RoleUsers::class, 'service_metier_id');
    }

    public function etapesWorkflowResponsable()
    {
        return $this->hasMany(EtapeWorkflow::class, 'service_responsable_id');
    }

    /**
     * Documents archivés par les utilisateurs dont le rôle appartient à ce service métier.
     */
    public function consulterArchives()
    {
        $utilisateurIds = Utilisateurs::whereHas('roles', function ($query) {
            $query->where('service_metier_id', $this->id);
        })->pluck('id');

        return DocumentArchive::whereIn('utilisateur_id', $utilisateurIds)->get();
    }
}
