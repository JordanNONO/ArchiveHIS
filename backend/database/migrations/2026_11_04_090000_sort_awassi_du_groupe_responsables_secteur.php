<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * M. Awassi n'est pas Responsable Secteur : il est Analyste financier et
 * responsable d'exploitation. La migration du 2026-08-18
 * (creer_roles_specialises_responsable_secteur) lui avait attribué
 * "Responsable Secteur Exploitation" (RS_EXPLOITATION) en croyant corriger
 * l'intitulé de son poste — c'était le mauvais intitulé.
 *
 * Ce n'est pas qu'une étiquette : le groupe "Responsables Secteur" des appels
 * téléphoniques repère ses membres par le code (RS et RS_*, voir
 * AppelTelephonique::filtrerRolesDuGroupe), tout comme le traitement réservé
 * des congés. Tant que son rôle commence par RS_, il reçoit des appels et des
 * congés qui ne le concernent pas. Il lui faut donc un code à lui.
 *
 * Ses permissions actuelles sont reprises à l'identique : le but est de le
 * sortir du groupe, pas de lui retirer des accès.
 */
return new class extends Migration
{
    private const ANCIEN_CODE = 'RS_EXPLOITATION';
    private const ANCIEN_NOM = 'Responsable Secteur Exploitation';
    private const NOUVEAU_CODE = 'ANALYSTE_FINANCIER';
    private const NOUVEAU_NOM = 'Analyste financier et responsable d\'exploitation';

    public function up(): void
    {
        $ancien = DB::table('roles')->where('code_role', self::ANCIEN_CODE)->first();
        if (!$ancien) {
            return;
        }

        $this->deplacer($ancien, self::NOUVEAU_CODE, self::NOUVEAU_NOM);
    }

    public function down(): void
    {
        $nouveau = DB::table('roles')->where('code_role', self::NOUVEAU_CODE)->first();
        if (!$nouveau) {
            return;
        }

        $this->deplacer($nouveau, self::ANCIEN_CODE, self::ANCIEN_NOM);
    }

    /**
     * Crée le rôle cible (mêmes permissions et même rattachement de service
     * que la source), y bascule les comptes, puis supprime la source devenue
     * vide. Écrit dans les deux sens pour que la migration soit réversible.
     */
    private function deplacer(object $source, string $codeCible, string $nomCible): void
    {
        $cibleId = DB::table('roles')->where('code_role', $codeCible)->value('id');

        if (!$cibleId) {
            $cibleId = DB::table('roles')->insertGetId([
                'nom' => $nomCible,
                'code_role' => $codeCible,
                'acreditation' => $source->acreditation,
                'service_metier_id' => $source->service_metier_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $permissions = DB::table('permission_role')->where('role_id', $source->id)->pluck('permission_id');
            foreach ($permissions as $permissionId) {
                DB::table('permission_role')->insert([
                    'role_id' => $cibleId,
                    'permission_id' => $permissionId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Un compte déjà rattaché au rôle cible ne doit pas l'être deux fois.
        $dejaCible = DB::table('role_user')->where('role_id', $cibleId)->pluck('utilisateur_id');
        DB::table('role_user')
            ->where('role_id', $source->id)
            ->whereNotIn('utilisateur_id', $dejaCible)
            ->update(['role_id' => $cibleId, 'updated_at' => now()]);
        DB::table('role_user')->where('role_id', $source->id)->delete();

        DB::table('permission_role')->where('role_id', $source->id)->delete();
        DB::table('roles')->where('id', $source->id)->delete();
    }
};
