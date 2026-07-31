<?php
use App\Http\Controllers\ActiviteController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BureauController;
use App\Http\Controllers\CategorieController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\InscriptionController;
use App\Http\Controllers\MotDePasseOublieController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PartageExterneController;
use App\Http\Controllers\ServiceMetierController;
use App\Http\Controllers\SuiviDelaiController;
use App\Http\Controllers\TelechargementController;
use App\Http\Controllers\TypeDocumentController;
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

// Auto-inscription des comptes intervenant/bénéficiaire (pas de personnel interne),
// vérifiée par code à usage unique avant toute création de compte.
Route::post('/inscription/code', [InscriptionController::class, 'envoyerCode'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::post('/inscription/verifier', [InscriptionController::class, 'verifierEtCreer'])->withoutMiddleware([AuthPersonnelMiddleware::class]);

// Mot de passe oublié, par code à usage unique — universel à tout type de
// compte (personnel interne, intervenant, bénéficiaire).
Route::post('/mot-de-passe-oublie/code', [MotDePasseOublieController::class, 'envoyerCode'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::post('/mot-de-passe-oublie/reinitialiser', [MotDePasseOublieController::class, 'reinitialiser'])->withoutMiddleware([AuthPersonnelMiddleware::class]);

// Espace de consultation externe (avocats, experts-comptables...) : accès par
// token public + code à usage unique, jamais par le compte personnel.
Route::get('/partages-externes/{token}', [PartageExterneController::class, 'infos'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::post('/partages-externes/{token}/code', [PartageExterneController::class, 'envoyerCode'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::post('/partages-externes/{token}/verifier', [PartageExterneController::class, 'verifierCode'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::get('/partages-externes/{token}/document', [PartageExterneController::class, 'document'])->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::get('/partages-externes/{token}/telecharger', [PartageExterneController::class, 'telecharger'])->withoutMiddleware([AuthPersonnelMiddleware::class]);

//Bureau
Route::get('/bureaux', [BureauController::class, 'index']);
Route::post('/bureaux', [BureauController::class, 'store'])->middleware('permission:gerer_utilisateurs');
Route::get('/bureaux/{code_bureau}', [BureauController::class, 'show']);
Route::put('/bureaux/{code_bureau}', [BureauController::class, 'update'])->middleware('permission:gerer_utilisateurs');
Route::delete('/bureaux/{code_bureau}', [BureauController::class, 'destroy'])->middleware('permission:gerer_utilisateurs');

//Cathegorie
Route::get('/categories', [CategorieController::class, 'index']);
Route::post('/categories', [CategorieController::class, 'store'])->middleware('permission:gerer_categories');
Route::get('/categories/{id_cat}', [CategorieController::class, 'show']);
Route::put('/categories/{id_cat}', [CategorieController::class, 'update'])->middleware('permission:gerer_categories');
Route::delete('/categories/{id_cat}', [CategorieController::class, 'destroy'])->middleware('permission:gerer_categories');
Route::post('/categories/{id_cat}/download', [CategorieController::class, 'download'])->middleware('permission:consulter_archives');

//Types de documents (sous-catégories)
Route::get('/type-documents', [TypeDocumentController::class, 'index']);
Route::post('/type-documents', [TypeDocumentController::class, 'store'])->middleware('permission:gerer_categories');
Route::put('/type-documents/{id}', [TypeDocumentController::class, 'update'])->middleware('permission:gerer_categories');
Route::delete('/type-documents/{id}', [TypeDocumentController::class, 'destroy'])->middleware('permission:gerer_categories');
Route::post('/type-documents/{id}/download', [TypeDocumentController::class, 'download'])->middleware('permission:consulter_archives');
//Consultation (seul le dépôt d'une nouvelle consultation reste ouvert à tout
// compte authentifié — la liste globale et le CRUD par ID n'étaient utilisés
// par aucune page du frontend et exposaient tout le journal de consultation)
Route::post('/consultations', [ConsultationController::class, 'store']);
//Documents
Route::get('/documents', [DocumentController::class, 'index']);
Route::get('/documents/count', [DocumentController::class, 'countDoc']);
Route::get('/documents/partages-recus', [DocumentController::class, 'partagesRecus']);
Route::get('/documents/trash', [DocumentController::class, 'trash']);
Route::get('/documents/a-traiter', [DocumentController::class, 'aTraiter']);
Route::post('/documents', [DocumentController::class, 'store'])->middleware('permission:creer_documents');
// show()/downloadVersion() servent le fichier brut en <img>/<iframe>/lien direct —
// aucun en-tête Authorization possible. Accès exclusivement via lien signé à durée
// limitée (voir lienFichier()/lienFichierVersion(), qui vérifient la visibilité
// avant de délivrer le lien) : la signature remplace l'authentification classique.
Route::get('/documents/{doc_id}', [DocumentController::class, 'show'])->name('documents.show')->middleware('signed')->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::put('/documents/{doc_id}', [DocumentController::class, 'update']);
Route::delete('/documents/{doc_id}', [DocumentController::class, 'destroy']);
Route::post('/documents/{doc_id}/restore', [DocumentController::class, 'restore']);
Route::delete('/documents/{doc_id}/force', [DocumentController::class, 'forceDestroy']);
Route::get('/documents/{document}/meta', [DocumentController::class, 'meta']);
Route::get('/documents/{document}/lien-fichier', [DocumentController::class, 'lienFichier']);
Route::post('/documents/{document}/share', [DocumentController::class, 'share']);
Route::post('/documents/{document}/transition', [DocumentController::class, 'transition'])->middleware('permission:valider_documents');
Route::get('/documents/{document}/historique', [DocumentController::class, 'historique']);
Route::get('/documents/{document}/consultations', [DocumentController::class, 'consultations']);
Route::get('/documents/{document}/versions', [DocumentController::class, 'versions']);
Route::post('/documents/{document}/versions', [DocumentController::class, 'newVersion'])->middleware('permission:archiver_documents');
// Pas de permission ici volontairement : un déposant (intervenant/bénéficiaire)
// n'a ni archiver_documents ni valider_documents — corrigerEtRenvoyer() vérifie
// lui-même qu'il s'agit bien de son propre document, rejeté.
Route::post('/documents/{document}/corriger-et-renvoyer', [DocumentController::class, 'corrigerEtRenvoyer']);
Route::get('/documents/{document}/versions/{versionId}/download', [DocumentController::class, 'downloadVersion'])->name('documents.versions.download')->middleware('signed')->withoutMiddleware([AuthPersonnelMiddleware::class]);
Route::get('/documents/{document}/versions/{versionId}/lien-fichier', [DocumentController::class, 'lienFichierVersion']);
Route::get('/documents/{document}/verifier-integrite', [DocumentController::class, 'verifierIntegrite']);

// Suivi des délais (procédures à échéance légale/interne, alertes vert/orange/rouge)
Route::get('/categories/{categorie}/etapes-workflow', [SuiviDelaiController::class, 'etapesPourCategorie']);
Route::get('/suivis-delais', [SuiviDelaiController::class, 'index']);
Route::get('/suivis-delais/compteurs', [SuiviDelaiController::class, 'compteurs']);
Route::post('/documents/{document}/suivi-delai', [SuiviDelaiController::class, 'demarrer'])->middleware('permission:archiver_documents');
Route::post('/suivis-delais/{suivi}/avancer', [SuiviDelaiController::class, 'avancer'])->middleware('permission:valider_documents');
Route::post('/suivis-delais/{suivi}/cloturer', [SuiviDelaiController::class, 'cloturer'])->middleware('permission:valider_documents');


//Personnels
Route::get('/personnels', [PersonnelController::class, 'index']);
Route::get('/personnels/connectes', [PersonnelController::class, 'connectes'])->middleware('permission:gerer_utilisateurs');
Route::post('/personnels', [PersonnelController::class, 'store'])->middleware('permission:gerer_utilisateurs');
Route::get('/personnels/show', [PersonnelController::class, 'show']);
Route::put('/personnels', [PersonnelController::class, 'update']);
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

//Notifications
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

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

//Activité (fil global, tous documents)
Route::get('/activite', [ActiviteController::class, 'index'])->middleware('permission:consulter_archives');

//Téléchargements groupés (ZIP de dossier, générés en tâche de fond)
Route::get('/telechargements', [TelechargementController::class, 'index']);
Route::get('/telechargements/{id}/fichier', [TelechargementController::class, 'fichier'])
    ->name('telechargements.fichier')
    ->middleware('signed')
    ->withoutMiddleware([AuthPersonnelMiddleware::class]);
