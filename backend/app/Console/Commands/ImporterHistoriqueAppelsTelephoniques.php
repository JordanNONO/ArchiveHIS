<?php

namespace App\Console\Commands;

use App\Models\AppelTelephonique;
use App\Models\Utilisateurs;
use Illuminate\Console\Command;

/**
 * Import ponctuel (à lancer une seule fois) des appels déjà enregistrés
 * dans l'ancien registre Excel/papier — voir
 * "Registre-appel-telephonique-Excel.xlsx" fourni par l'utilisateur. Les
 * lignes vides du fichier (la grande majorité, des milliers de N° jamais
 * utilisés) ne sont évidemment pas reprises, seules les 16 lignes réellement
 * remplies le sont.
 *
 * Choix faits faute de mieux sur certaines lignes incomplètes dans le
 * fichier d'origine :
 * - Appelant sans nom renseigné (GRENKE, EDENRED, "Assistante sociale") :
 *   on reprend l'organisation ou la qualité comme nom, à corriger via
 *   "Modifier" dans le registre si besoin.
 * - "Personne concernée" reste en texte libre (personne_concernee_texte),
 *   jamais relié à une vraie fiche personnel (personnel_concerne_id) : pas
 *   moyen de vérifier ici qu'"Mme Jelassi"/"M. Nyobe" du fichier correspond
 *   bien à telle fiche précise en base, mieux vaut ne pas deviner.
 * - Ligne N°0013, sans action cochée dans le fichier d'origine : "Pour
 *   info" par défaut (la moins engageante), à corriger si besoin.
 */
class ImporterHistoriqueAppelsTelephoniques extends Command
{
    protected $signature = 'appels:importer-historique';

    protected $description = "Importe une fois les appels deja enregistres dans l'ancien registre Excel";

    public function handle(): int
    {
        $agentFannel = Utilisateurs::whereHas('personnels', function ($q) {
            $q->where('prenom', 'like', 'Fannel%')->orWhere('nom', 'like', 'Fannel%');
        })->first();

        $administrateur = Utilisateurs::whereHas('roles', fn ($q) => $q->where('nom', 'Administrator'))->first();

        $utilisateurParDefaut = $agentFannel ?? $administrateur;

        if (!$utilisateurParDefaut) {
            $this->error("Aucun utilisateur trouve (ni 'Fannel', ni un compte Administrateur) -- import annule.");
            return self::FAILURE;
        }

        if ($agentFannel) {
            $this->info("Agent 'Fannel' trouve (utilisateur #{$agentFannel->id}) -- utilise pour les appels qu'il a pris.");
        } else {
            $this->warn("Aucun utilisateur 'Fannel' trouve -- tous les appels seront rattaches a l'administrateur #{$administrateur->id}. Corrigez via \"Modifier\" dans le registre si besoin.");
        }

        $lignes = [
            [
                'date_appel' => '2022-03-11', 'heure_appel' => '17:14',
                'appelant_nom' => 'Laurent Giraud', 'appelant_telephone' => '06 65 89 89 89',
                'appelant_organisation' => 'Journal Le Monde', 'appelant_qualite' => 'Journaliste',
                'objet' => 'Interview',
                'message' => "Souhaite parler au directeur dans le cadre de la nouvelle règlementation",
                'personne_concernee_texte' => 'M. le Directeur', 'action' => 'Rappeler URGENT',
            ],
            [
                'date_appel' => '2026-09-07', 'heure_appel' => '09:04',
                'appelant_nom' => 'M. Traoré Moussa', 'appelant_telephone' => '06 52 53 02 46',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Client',
                'objet' => 'Infos planning transport',
                'message' => "Il a rappelé l'importance de son RV de 11h et demandé que le chauffeur l'accompagne en plus à Bobigny récupérer un colis",
                'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-07', 'heure_appel' => '10:27',
                'appelant_nom' => 'Mme Souliman', 'appelant_telephone' => '06 95 15 71 14',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Client',
                'objet' => 'Demande à parler à Sonia pour le planning de Mme Bensarahoui',
                'message' => "Elle voudrait signaler que l'intervention d'aujourd'hui sera rallongée de 14h à 17h. Mais elle le dira à Sonia directement demain.",
                'personne_concernee_texte' => 'Mme Jelassi', 'action' => 'Rappellera',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '10:44',
                'appelant_nom' => 'GRENKE', 'appelant_telephone' => '01 75 62 05 75',
                'appelant_organisation' => 'GRENKE', 'appelant_qualite' => 'Fournisseur',
                'objet' => 'Restitution téléphones',
                'message' => 'À quelle date venir récupérer le matériel ?',
                'personne_concernee_texte' => 'M. Kenne', 'action' => 'Rappeler URGENT',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '11:05',
                'appelant_nom' => 'Aimable Amado Frauca', 'appelant_telephone' => '06 64 44 62 04',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Client',
                'objet' => 'Parler à Mme Jelassi',
                'personne_concernee_texte' => 'Mme Jelassi', 'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '11:15',
                'appelant_nom' => 'Mme Ngo Nyemb Berthe', 'appelant_telephone' => '06 14 08 48 08',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Salariée',
                'objet' => 'RDV avec Mme Jelassi',
                'personne_concernee_texte' => 'Mme Jelassi', 'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '11:27',
                'appelant_nom' => 'Mme Ngousso', 'appelant_telephone' => '06 44 85 31 66',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Cliente',
                'objet' => 'Parler à Mme Jelassi',
                'personne_concernee_texte' => 'Mme Jelassi', 'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '14:13',
                'appelant_nom' => 'EDENRED', 'appelant_telephone' => '03 79 33 70 88',
                'appelant_organisation' => 'EDENRED', 'appelant_qualite' => 'Fournisseur',
                'objet' => 'Parler à M. Nyobe',
                'message' => 'Discuter des avantages sociaux des salariés',
                'oriente_service' => 'RH', 'personne_concernee_texte' => 'M. Nyobe', 'action' => 'Rappellera',
            ],
            [
                'date_appel' => '2026-09-08', 'heure_appel' => '15:22',
                'appelant_nom' => 'Assistante sociale', 'appelant_telephone' => '01 53 46 15 24',
                'appelant_qualite' => 'Assistante sociale',
                'objet' => 'Renseignement prospect',
                'oriente_service' => 'Responsables de secteur', 'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-09', 'heure_appel' => '09:57',
                'appelant_nom' => 'Mme Aderomou', 'appelant_telephone' => '07 49 54 92 05',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Ancienne salariée',
                'objet' => 'Demande de documents de sortie',
                'message' => "M. Nyobe lui aurait dit qu'il lui enverrait un document de sortie mais elle me dit avoir déjà récupéré son solde de tout compte, son attestation France Travail contre signature",
                'personne_concernee_texte' => 'M. Nyobe', 'action' => 'Rappeler',
            ],
            [
                'date_appel' => '2026-09-09', 'heure_appel' => '10:38',
                'appelant_nom' => 'GRENKE', 'appelant_telephone' => '01 75 62 05 75',
                'appelant_organisation' => 'GRENKE', 'appelant_qualite' => 'Fournisseur',
                'objet' => 'Restitution téléphones',
                'message' => 'Ils vont contacter le gérant directement',
                'personne_concernee_texte' => 'M. Kenne', 'action' => 'Rappeler URGENT',
            ],
            [
                'date_appel' => '2026-09-09', 'heure_appel' => '14:06',
                'appelant_nom' => 'Mme Nguessan Glwadys', 'appelant_telephone' => '07 58 35 96 84',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Salariée',
                'objet' => "Demande d'attestation employeur",
                'action' => 'Pour info',
            ],
            [
                'date_appel' => '2026-09-10', 'heure_appel' => '11:23',
                'appelant_nom' => 'Mme Zoulikha Belhadef Sergma', 'appelant_telephone' => '06 51 22 59 23',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Cliente',
                'objet' => 'Reprise des interventions',
                'message' => "Elle est rentrée de voyage et elle aimerait que les plannings reprennent chez elle",
                'personne_concernee_texte' => 'Mme Mbock', 'action' => 'Pour info',
            ],
            [
                'date_appel' => '2026-09-10', 'heure_appel' => '11:42',
                'appelant_nom' => 'M. Ayissi Minkoulou Guy Rolland', 'appelant_telephone' => '07 55 88 01 20',
                'appelant_organisation' => 'HIS', 'appelant_qualite' => 'Ancien salarié',
                'objet' => 'Demande de documents de sortie',
                'message' => 'Il sera recontacté une fois que les documents sont prêts pour venir signer sur place',
                'action' => 'Pour info',
            ],
            [
                'date_appel' => '2026-09-11', 'heure_appel' => '09:56',
                'appelant_nom' => 'M. Abbas', 'appelant_telephone' => '06 31 28 45 33',
                'appelant_organisation' => 'HSP',
                'objet' => "Retour de notre demande de communication - apparition dans leur journal de Cergy",
                'oriente_service' => 'Communication', 'action' => 'Rappeler',
            ],
        ];

        $importes = 0;
        $ignores = 0;
        foreach ($lignes as $ligne) {
            $dejaImporte = AppelTelephonique::where('appelant_nom', $ligne['appelant_nom'])
                ->where('date_appel', $ligne['date_appel'])
                ->where('heure_appel', $ligne['heure_appel'])
                ->exists();
            if ($dejaImporte) {
                $ignores++;
                continue;
            }

            AppelTelephonique::create(array_merge($ligne, [
                'utilisateur_id' => $utilisateurParDefaut->id,
            ]));
            $importes++;
        }

        $this->info("{$importes} appel(s) importe(s), {$ignores} deja present(s) ignore(s) (relance sans risque de doublon).");

        return self::SUCCESS;
    }
}
