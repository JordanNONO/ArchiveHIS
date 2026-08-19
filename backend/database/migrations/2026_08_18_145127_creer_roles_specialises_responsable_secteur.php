<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * "Responsable Secteur" recouvrait jusqu'ici 4 personnes aux spécialités
 * distinctes dans la réalité (Qualité, Exploitation, Coordination), sans
 * aucune différence dans l'application — un seul rôle plat. Le besoin exprimé
 * (2026-08-18) n'est PAS de différencier les droits (les 4 continuent à faire
 * strictement la même chose : mêmes permissions, même accès transverse sauf
 * Comptabilité/Paie), seulement de nommer correctement le rôle de chacun.
 *
 * Josette (RSP) reste sur le rôle générique "Responsable Secteur" — elle n'a
 * pas de spécialité précisée. Sall (Qualité), Awassi (Exploitation) et Sonia
 * (Coordination) migrent vers un rôle dédié, copie conforme des permissions
 * du rôle générique.
 */
return new class extends Migration
{
    private const SPECIALITES = [
        'qem.his1@donnerlavieauxannees.com' => ['nom' => 'Responsable Secteur Qualité', 'code' => 'RS_QUALITE'],
        'poleficpta2@donnerlavieauxannees.com' => ['nom' => 'Responsable Secteur Exploitation', 'code' => 'RS_EXPLOITATION'],
        'soniaj2@donnerlavieauxannees.com' => ['nom' => 'Responsable Secteur Coordination', 'code' => 'RS_COORDINATION'],
    ];

    public function up(): void
    {
        $roleGenerique = DB::table('roles')->where('code_role', 'RESPONSABLE_SECTEUR')->first();
        if (!$roleGenerique) {
            return;
        }

        // Raccourci en "RS" pour rester cohérent avec le préfixe des variantes
        // spécialisées ci-dessous (RS_QUALITE, RS_EXPLOITATION, RS_COORDINATION).
        DB::table('roles')->where('id', $roleGenerique->id)->update(['code_role' => 'RS', 'updated_at' => now()]);

        $permissionsGenerique = DB::table('permission_role')->where('role_id', $roleGenerique->id)->pluck('permission_id');

        foreach (self::SPECIALITES as $email => $specialite) {
            $utilisateur = DB::table('utilisateurs')->where('mail', $email)->first();
            if (!$utilisateur) {
                continue;
            }

            $nouveauRoleId = DB::table('roles')->insertGetId([
                'nom' => $specialite['nom'],
                'code_role' => $specialite['code'],
                'service_metier_id' => $roleGenerique->service_metier_id,
                'exclut_service_metier_id' => $roleGenerique->exclut_service_metier_id,
                'acreditation' => $roleGenerique->acreditation,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($permissionsGenerique as $permissionId) {
                DB::table('permission_role')->insert([
                    'role_id' => $nouveauRoleId,
                    'permission_id' => $permissionId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('role_user')
                ->where('utilisateur_id', $utilisateur->id)
                ->where('role_id', $roleGenerique->id)
                ->update(['role_id' => $nouveauRoleId, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        $roleGenerique = DB::table('roles')->where('code_role', 'RS')->first();
        if (!$roleGenerique) {
            return;
        }

        foreach (self::SPECIALITES as $email => $specialite) {
            $role = DB::table('roles')->where('code_role', $specialite['code'])->first();
            if (!$role) {
                continue;
            }

            DB::table('role_user')
                ->where('role_id', $role->id)
                ->update(['role_id' => $roleGenerique->id, 'updated_at' => now()]);

            DB::table('permission_role')->where('role_id', $role->id)->delete();
            DB::table('roles')->where('id', $role->id)->delete();
        }

        DB::table('roles')->where('id', $roleGenerique->id)->update(['code_role' => 'RESPONSABLE_SECTEUR', 'updated_at' => now()]);
    }
};
