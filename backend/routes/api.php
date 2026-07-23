<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BureauController;
use App\Http\Controllers\CategorieController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\ServiceMetierController;
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
Route::post('/categories', [CategorieController::class, 'store'])->middleware('permission:gerer_categories');
Route::get('/categories/{id_cat}', [CategorieController::class, 'show']);
Route::put('/categories/{id_cat}', [CategorieController::class, 'update'])->middleware('permission:gerer_categories');
Route::delete('/categories/{id_cat}', [CategorieController::class, 'destroy'])->middleware('permission:gerer_categories');
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
Route::get('/documents/{document}/meta', [DocumentController::class, 'meta']);
Route::post('/documents/{document}/transition', [DocumentController::class, 'transition'])->middleware('permission:valider_documents');
Route::get('/documents/{document}/historique', [DocumentController::class, 'historique']);
Route::get('/documents/{document}/verifier-integrite', [DocumentController::class, 'verifierIntegrite']);


//Personnels
Route::get('/personnels', [PersonnelController::class, 'index']);
Route::post('/personnels', [PersonnelController::class, 'store']);
Route::get('/personnels/show', [PersonnelController::class, 'show']);
Route::post('/personnels', [PersonnelController::class, 'update']);
Route::post('/personnels/profile', [PersonnelController::class, 'updateProfile']);
Route::delete('/personnels', [PersonnelController::class, 'destroy']);
Route::put('/personnels/{id}', [PersonnelController::class, 'updateById'])->middleware('permission:gerer_utilisateurs');
Route::delete('/personnels/{id}', [PersonnelController::class, 'destroyById'])->middleware('permission:gerer_utilisateurs');

//Roles
Route::get('/roles', [RoleController::class, 'index']);
Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:gerer_roles');
Route::get('/roles/{code_role}', [RoleController::class, 'show']);
Route::put('/roles/{code_role}', [RoleController::class, 'update'])->middleware('permission:gerer_roles');
Route::delete('/roles/{code_role}', [RoleController::class, 'destroy'])->middleware('permission:gerer_roles');
Route::post('/roles/{role}/permissions', [RoleController::class, 'attachPermissions'])->middleware('permission:gerer_roles');
Route::delete('/roles/{role}/permissions/{permission}', [RoleController::class, 'detachPermission'])->middleware('permission:gerer_roles');

//Permissions
Route::get('/permissions', [PermissionController::class, 'index']);
Route::post('/permissions', [PermissionController::class, 'store'])->middleware('permission:gerer_permissions');
Route::get('/permissions/{permission}', [PermissionController::class, 'show']);
Route::put('/permissions/{permission}', [PermissionController::class, 'update'])->middleware('permission:gerer_permissions');
Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy'])->middleware('permission:gerer_permissions');

//Services métier
Route::get('/services-metier', [ServiceMetierController::class, 'index']);
Route::post('/services-metier', [ServiceMetierController::class, 'store'])->middleware('permission:gerer_services_metier');
Route::get('/services-metier/{service}', [ServiceMetierController::class, 'show']);
Route::put('/services-metier/{service}', [ServiceMetierController::class, 'update'])->middleware('permission:gerer_services_metier');
Route::delete('/services-metier/{service}', [ServiceMetierController::class, 'destroy'])->middleware('permission:gerer_services_metier');
Route::get('/services-metier/{service}/archives', [ServiceMetierController::class, 'archives'])->middleware('permission:consulter_archives');

//Storage

Route::post("/storage",[StorageController::class,'store']);
