<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BureauController;
use App\Http\Controllers\CategorieController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\StorageController;
use App\Http\Middleware\AuthPersonnelMiddleware;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return "Api run sige";
});
//Authentification
/* Route::post('/auth', [AuthController::class, 'authenticate']);
Route::post('/login', [AuthController::class, 'login']); */

Route::group([
    "middleware"=>'api',
    "prefix"=>'auth'
], function($router){
    Route::post('/', [AuthController::class, 'authenticate'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/update', [AuthController::class, 'update']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

//Bureau
Route::get('/bureaux', [BureauController::class, 'index']);
Route::post('/bureaux', [BureauController::class, 'store']);
Route::get('/bureaux/{code_bureau}', [BureauController::class, 'show']);
Route::put('/bureaux/{code_bureau}', [BureauController::class, 'update']);
Route::delete('/bureaux/{code_bureau}', [BureauController::class, 'destroy']);

//Cathegorie
Route::get('/categories', [CategorieController::class, 'index']);
Route::post('/categories', [CategorieController::class, 'store']);
Route::get('/categories/{id_cat}', [CategorieController::class, 'show']);
Route::put('/categories/{id_cat}', [CategorieController::class, 'update']);
Route::delete('/categories/{id_cat}', [CategorieController::class, 'destroy']);
//Consultation
Route::get('/consultations', [ConsultationController::class, 'index']);
Route::post('/consultations', [ConsultationController::class, 'store']);
Route::get('/consultations/{code_pers}/{doc_id}', [ConsultationController::class, 'show']);
Route::put('/consultations/{code_pers}/{doc_id}', [ConsultationController::class, 'update']);
Route::delete('/consultations/{code_pers}/{doc_id}', [ConsultationController::class, 'destroy']);
//Documents
Route::get('/documents', [DocumentController::class, 'index']);
Route::post('/documents/share', [DocumentController::class, 'share']);
Route::get('/documents/count', [DocumentController::class, 'countDoc']);
Route::post('/documents', [DocumentController::class, 'store']);
Route::get('/documents/{doc_id}', [DocumentController::class, 'show'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::put('/documents/{doc_id}', [DocumentController::class, 'update']);
Route::delete('/documents/{doc_id}', [DocumentController::class, 'destroy']);


//Personnels
Route::get('/personnels', [PersonnelController::class, 'index']);
Route::post('/personnels', [PersonnelController::class, 'store']);
Route::get('/personnels/show', [PersonnelController::class, 'show']);
Route::post('/personnels', [PersonnelController::class, 'update']);
Route::post('/personnels/profile', [PersonnelController::class, 'updateProfile']);
Route::delete('/personnels', [PersonnelController::class, 'destroy']);

//Roles
Route::get('/roles', [RoleController::class, 'index']);
Route::post('/roles', [RoleController::class, 'store']);
Route::get('/roles/{code_role}', [RoleController::class, 'show']);
Route::put('/roles/{code_role}', [RoleController::class, 'update']);
Route::delete('/roles/{code_role}', [RoleController::class, 'destroy']);

//Storage

Route::post("/storage",[StorageController::class,'store']);