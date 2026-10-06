<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Marie Solange (smvhis1@donnerlavieauxannees.com) occupe en réalité le
 * poste "Responsable Performance" (nouveau rôle créé par l'administrateur
 * via Réglages > Rôles, 2026-10-06) — elle garde néanmoins tout ce qu'elle
 * faisait déjà avec son rôle précédent (même principe que
 * creer_roles_specialises_responsable_secteur : copie des permissions avant
 * la bascule, jamais une perte de droits).
 *
 * updateOrInsert (pas insert) : contrairement à la migration RS, le rôle
 * cible ici n'est pas garanti vide — il peut déjà avoir reçu des
 * permissions manuellement via l'interface "Gérer les permissions" avant
 * cette migration, et permission_role a une contrainte unique
 * (role_id, permission_id) qu'un simple insert() ferait échouer en cas de
 * recouvrement.
 */
return new class extends Migration
{
    public function up(): void
    {
        $nouveauRole = DB::table('roles')->where('nom', 'Responsable Performance')->first();
        if (!$nouveauRole) {
            return;
        }

        $utilisateur = DB::table('utilisateurs')->where('mail', 'smvhis1@donnerlavieauxannees.com')->first();
        if (!$utilisateur) {
            return;
        }

        $assignationsActuelles = DB::table('role_user')->where('utilisateur_id', $utilisateur->id)->get();
        if ($assignationsActuelles->isEmpty()) {
            return;
        }

        $anciensRoleIds = $assignationsActuelles->pluck('role_id')->unique();
        $permissionsActuelles = DB::table('permission_role')
            ->whereIn('role_id', $anciensRoleIds)
            ->pluck('permission_id')
            ->unique();

        foreach ($permissionsActuelles as $permissionId) {
            DB::table('permission_role')->updateOrInsert(
                ['role_id' => $nouveauRole->id, 'permission_id' => $permissionId],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }

        DB::table('role_user')
            ->where('utilisateur_id', $utilisateur->id)
            ->whereIn('role_id', $anciensRoleIds)
            ->update(['role_id' => $nouveauRole->id, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Volontairement pas de retour arrière automatique : on ne sait plus,
        // après coup, quel était l'ancien role_id exact si d'autres
        // changements sont intervenus entre-temps — une restauration à la
        // main (Réglages > Utilisateurs) est plus sûre qu'une supposition.
    }
};
