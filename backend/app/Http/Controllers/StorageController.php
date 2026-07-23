<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Request;
class StorageController extends Controller{
    public function store(Request $request){
        $size = Storage::disk('sftp')->move("mecanique","Mécanique");
        return response()->json(["size"=>$size]);
    }
}