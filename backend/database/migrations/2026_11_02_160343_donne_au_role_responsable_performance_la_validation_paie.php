<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Les demandes de fiche de paie doivent pouvoir être traitées par la
 * Comptabilité ET par le Responsable Performance (demande explicite,
 * 2026-11) — jusqu'ici seule la Comptabilité/Paie (Éditeur du service
 * Comptabilité, Paie & Finance) le pouvait, le rôle "Responsable Secteur"
 * étant lui volontairement exclu de ce service (voir
 * DocumentStatusService::validateursDuService(), exclut_service_metier_id).
 *
 * Rattacher ce rôle au service Comptabilité, Paie & Finance (comme un
 * Éditeur de ce service) lui donne accès à la branche "service propriétaire"
 * de validateursDuService() ; la permission valider_documents est ajoutée
 * séparément s'il ne l'avait pas déjà (ex: rôle créé via Réglages > Rôles
 * sans cette permission).
 *
 * updateOrInsert : permission_role a une contrainte unique
 * (role_id, permission_id), un simple insert() échouerait si la permission
 * est déjà accordée — même précaution que la migration
 * delegue_marie_solange_au_role_responsable_performance.
 */
return new class extends Migration
{
    public function up(): void
    {
        $role = DB::table('roles')->where('nom', 'Responsable Performance')->first();
        if (!$role) {
            return;
        }

        $serviceCompta = DB::table('services_metier')->where('code_service', 'COMPTA')->first();
        if (!$serviceCompta) {
            return;
        }

        DB::table('roles')->where('id', $role->id)->update([
            'service_metier_id' => $serviceCompta->id,
            'updated_at' => now(),
        ]);

        $permissionValider = DB::table('permissions')->where('code_perm', 'valider_documents')->first();
        if ($permissionValider) {
            DB::table('permission_role')->updateOrInsert(
                ['role_id' => $role->id, 'permission_id' => $permissionValider->id],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }
    }

    public function down(): void
    {
        // Volontairement pas de retour arrière automatique : on ne connaît
        // plus, après coup, le service_metier_id d'origine du rôle (même
        // raisonnement que delegue_marie_solange_au_role_responsable_performance).
    }
};
