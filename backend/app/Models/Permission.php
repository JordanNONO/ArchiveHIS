<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'code_perm',
        'label_perm',
    ];

    public function roles()
    {
        return $this->belongsToMany(RoleUsers::class, 'permission_role');
    }
}
