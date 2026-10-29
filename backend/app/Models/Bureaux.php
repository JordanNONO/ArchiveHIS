<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Bureaux extends Model
{
    use HasFactory;
    protected $table = "bureaux";
    protected $primaryKey = "id";
    public $incrementing = true;

    protected $fillable = [
        'name',
    ];
    protected $attributes =[
        "name"=>""
    ];

    public function personnels()
    {
        return $this->hasMany(Personnels::class, 'bureau_id');
    }
}
