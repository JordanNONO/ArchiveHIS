<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoleUsers extends Model
{
    use HasFactory;

    protected $table = 'roles';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'nom',
        'code_role',
        'acreditation',
        'service_metier_id',
        'exclut_service_metier_id',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'id' => 'integer',
    ];

    public function utilisateurs()
    {
        return $this->belongsToMany(Utilisateurs::class, 'role_user', 'role_id', 'utilisateur_id');
    }

    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'permission_role', 'role_id', 'permission_id');
    }

    public function serviceMetier()
    {
        return $this->belongsTo(ServiceMetier::class, 'service_metier_id');
    }

    public function serviceMetierExclu()
    {
        return $this->belongsTo(ServiceMetier::class, 'exclut_service_metier_id');
    }
}
