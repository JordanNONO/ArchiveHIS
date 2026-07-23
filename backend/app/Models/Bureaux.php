<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Bureaux extends Model
{
    use HasFactory;
    /**
     * Summary of table
     * @var string
     */
    protected $table = "bureaux";
    /**
     * Summary of primaryKey
     * @var string
     */
    protected $primaryKey = "id";
    /**
     * Summary of incrementing
     * @var bool
     */
    public $incrementing = true;
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    
    protected $fillable = [
        'name',
    ];
    /**
     * Summary of attributes
     * @var array
     */
    protected $attributes =[
        "name"=>""
    ];
}
