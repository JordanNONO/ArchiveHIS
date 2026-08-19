<?php

namespace Database\Seeders;

use App\Models\CategorieDocument;
use App\Models\TypeDocument;
use Illuminate\Database\Seeder;

class TypeDocumentSeeder extends Seeder
{
    /**
     * Sous-catégories (types de documents) par catégorie parente.
     *
     * Liste curatée à partir des types métier fournis par le client : les entrées
     * couvrant une plage (ex. "FDP-RH-001 à 009") sont ramenées à un type générique
     * réutilisable, et chaque type est rattaché à la catégorie la plus pertinente
     * plutôt qu'un simple copier-coller du regroupement d'origine.
     */
    private function types(): array
    {
        return [
            'RecrutementIntegration' => [
                ['libelle' => 'Fiche de besoin en recrutement', 'code' => 'FOR-RH-001'],
                ['libelle' => 'Annonce de recrutement', 'code' => 'FOR-RH-003'],
                ['libelle' => 'CV', 'code' => null],
                ['libelle' => 'Lettre de motivation', 'code' => null],
                ['libelle' => 'Diplôme (ADVF/AS)', 'code' => null],
                ['libelle' => 'Extrait de casier judiciaire n°3', 'code' => null],
                ['libelle' => "Grille d'entretien de recrutement", 'code' => null],
                ['libelle' => 'Lettre de refus de candidature', 'code' => 'FOR-RH-019'],
                ["libelle" => "Promesse d'embauche", 'code' => 'FOR-RH-020'],
                ["libelle" => "Kit d'accueil", 'code' => 'FOR-RH-006'],
                ['libelle' => 'Questionnaire à J+30', 'code' => 'FOR-RH-007'],
                ["libelle" => "Évaluation de fin de période d'essai", 'code' => 'FOR-RH-008'],
            ],
            'ContratDossier' => [
                ["libelle" => "Carte d'identité / Passeport", 'code' => null],
                ['libelle' => 'Titre de séjour', 'code' => null],
                ['libelle' => 'Carte Vitale', 'code' => null],
                ['libelle' => 'Permis de conduire / Carte grise', 'code' => null],
                ['libelle' => 'RIB', 'code' => null],
                ['libelle' => 'Contrat de travail (CDI/CDD)', 'code' => null],
                ['libelle' => 'Avenant au contrat', 'code' => 'FOR-RH-011'],
                ['libelle' => 'Publipostage', 'code' => 'FOR-RH-012'],
                ['libelle' => 'Navette avenant', 'code' => 'FOR-RH-013'],
                ['libelle' => 'Checklist dossier salarié', 'code' => 'FOR-RH-014'],
                ['libelle' => "DPAE (déclaration préalable à l'embauche)", 'code' => null],
                ['libelle' => 'Registre unique du personnel', 'code' => null],
                // Destinations du dépôt simplifié intervenant/bénéficiaire (voir EspaceIntervenant.jsx) —
                // tout remonte à la RH (y compris la paie, normalement gérée par la Comptabilité) :
                // c'est la RH qui redistribue en interne, pas au déposant de connaître l'organigramme.
                ['libelle' => 'Fiche de paie (dépôt)', 'code' => null],
                ['libelle' => 'Document administratif', 'code' => null],
                ['libelle' => 'Autre document', 'code' => null],
            ],
            'CongesAbsences' => [
                ['libelle' => 'Demande de congés', 'code' => 'FOR-RH-010'],
                ["libelle" => "Justificatif d'événement familial", 'code' => null],
                ['libelle' => 'Demande de congé paternité', 'code' => 'FOR-RH-025'],
                ['libelle' => 'Registre des absences', 'code' => 'FOR-RH-009'],
                ['libelle' => 'Mise en demeure', 'code' => 'FOR-RH-023'],
            ],
            'SanteAccidentTravail' => [
                ['libelle' => 'Arrêt de travail (volet 3)', 'code' => null],
                ["libelle" => "Suivi d'arrêt longue durée", 'code' => 'FOR-RH-024'],
                ["libelle" => "Attestation d'aptitude / inaptitude", 'code' => null],
                ['libelle' => 'Visite médicale de reprise', 'code' => 'FOR-RH-048'],
                ["libelle" => "Déclaration d'accident du travail (DAT)", 'code' => 'FOR-RH-036'],
                ['libelle' => 'Registre des accidents du travail', 'code' => 'PRO-RH-012'],
            ],
            'DisciplineContentieux' => [
                ['libelle' => 'Convocation à un entretien disciplinaire', 'code' => 'FOR-RH-015'],
                ["libelle" => "Procès-verbal d'entretien", 'code' => 'FOR-RH-016'],
                ['libelle' => 'Avertissement', 'code' => 'FOR-RH-040'],
                ['libelle' => 'Blâme', 'code' => 'FOR-RH-042'],
                ['libelle' => 'Mise à pied', 'code' => 'FOR-RH-043'],
                ['libelle' => 'Rétrogradation', 'code' => 'FOR-RH-044'],
            ],
            'EntretienEvaluation' => [
                ['libelle' => 'Convocation entretien annuel', 'code' => 'FOR-RH-037'],
                ['libelle' => 'Convocation entretien professionnel', 'code' => 'FOR-RH-035'],
                ["libelle" => "Grille d'évaluation", 'code' => 'FOR-RH-038'],
                ["libelle" => "Compte-rendu d'entretien", 'code' => 'FOR-RH-039'],
            ],
            'FormationContinue' => [
                ['libelle' => 'Demande de mobilité interne', 'code' => 'FOR-RH-031'],
                ['libelle' => 'Demande de formation', 'code' => 'FOR-RH-034'],
                ['libelle' => 'Plan de formation', 'code' => 'COM-RH-006'],
            ],
            'SortieRupture' => [
                ['libelle' => 'Lettre de démission', 'code' => null],
                ["libelle" => "Accusé de réception de démission", 'code' => 'FOR-RH-028'],
                ['libelle' => 'Dispense de préavis', 'code' => 'FOR-RH-029'],
                ['libelle' => 'Rupture conventionnelle (dossier DREETS)', 'code' => 'FOR-RH-018'],
                ['libelle' => 'Licenciement pour motif personnel', 'code' => 'FOR-RH-026'],
                ['libelle' => 'Licenciement pour faute grave', 'code' => 'FOR-RH-045'],
                ['libelle' => 'Licenciement pour faute lourde', 'code' => 'FOR-RH-046'],
                ['libelle' => 'Certificat de travail', 'code' => null],
                ['libelle' => 'Reçu pour solde de tout compte', 'code' => null],
                ['libelle' => 'Attestation employeur France Travail', 'code' => null],
            ],
            'QualiteRisque' => [
                ["libelle" => "Document unique d'évaluation des risques (DUERP)", 'code' => 'PRO-RH-006'],
                ['libelle' => 'Protocole accident du travail / incident', 'code' => 'COM-RH-005'],
                ["libelle" => "Rapport d'audit interne (NF Service/Qualiopi)", 'code' => null],
                ['libelle' => 'Fiche de réclamation client', 'code' => null],
                ['libelle' => 'Enquête de satisfaction', 'code' => null],
                ['libelle' => 'Protocole de bientraitance', 'code' => null],
                ['libelle' => 'Fiche pathologique bénéficiaire', 'code' => null],
                ["libelle" => "Calcul de l'index égalité professionnelle (EGAPRO)", 'code' => 'FOR-RH-050'],
                ['libelle' => 'Fiche de poste', 'code' => 'FDP-RH'],
            ],
            'GestionbenSecteur' => [
                ["libelle" => "Grille d'évaluation de l'autonomie (AGGIR/GIR)", 'code' => null],
                ["libelle" => "Planning d'intervention sectoriel", 'code' => null],
                ['libelle' => 'Dossier de prise en charge APA', 'code' => null],
                ['libelle' => 'Dossier PCH', 'code' => null],
                ['libelle' => 'Fiche de consignes au domicile', 'code' => null],
                ["libelle" => "Compte-rendu d'appel famille", 'code' => null],
                ["libelle" => "Fiche de remplacement d'urgence", 'code' => 'PRO-RH-007'],
                // Dépôt simplifié intervenant/bénéficiaire (voir EspaceIntervenant.jsx) — toute
                // réclamation remonte à la RH, qui la redirige en interne si besoin, plutôt que
                // de compter sur le déposant pour connaître le bon service.
                ['libelle' => 'Réclamation', 'code' => null],
                // Dossier "Prestation" du bénéficiaire (3 sous-types, voir typesDemande.js) —
                // demander/modifier/annuler le service d'aide à domicile lui-même.
                ['libelle' => 'Demande de prestation', 'code' => null],
                ['libelle' => 'Modification de prestation', 'code' => null],
                ['libelle' => 'Annulation de prestation', 'code' => null],
                // Dossier "Signalement" du bénéficiaire (remplace Réclamation côté
                // bénéficiaire, voir typesDemande.js) — catégories d'événements
                // alignées sur les pratiques du secteur médico-social à domicile.
                ['libelle' => 'Signalement d\'incident ou accident', 'code' => null],
                ['libelle' => 'Signalement de maltraitance ou comportement inapproprié', 'code' => null],
                ['libelle' => "Signalement de retard ou absence de l'intervenant", 'code' => null],
                ['libelle' => 'Signalement de qualité de la prestation', 'code' => null],
                ['libelle' => 'Signalement de sécurité au domicile', 'code' => null],
            ],
            'ComptpaieFinance' => [
                ['libelle' => 'Facture client', 'code' => null],
                ['libelle' => 'Fichier télématique de facturation (CD/APA/PCH/CCAS)', 'code' => null],
                ['libelle' => 'Extraction des heures de télégestion', 'code' => null],
                ['libelle' => 'Note de frais / indemnités kilométriques', 'code' => null],
                ['libelle' => 'Bulletin de paie', 'code' => null],
                // Demande d'un intervenant pour un mois précis (voir PaieForm.jsx) —
                // remplacée par le vrai bulletin quand la Compta répond (voir
                // DocumentController::decisionPaie), qui range alors le document
                // dans "Bulletin de paie" ci-dessus, au nom du salarié.
                ['libelle' => 'Demande de fiche de paie', 'code' => null],
                ['libelle' => 'Fichier DSN (Urssaf/Retraite/Prévoyance)', 'code' => null],
                ['libelle' => 'Rapprochement bancaire', 'code' => null],
                ['libelle' => 'Relance impayé', 'code' => null],
            ],
            'ComMarketing' => [
                ['libelle' => 'Plaquette de présentation des prestations (SAP)', 'code' => null],
                ['libelle' => 'Brochure tarifaire', 'code' => null],
                ["libelle" => "Annonce d'emploi officielle", 'code' => null],
                ['libelle' => 'Newsletter interne', 'code' => null],
                ['libelle' => 'Note de service', 'code' => 'COM-RH'],
            ],
            'SystemTelegestion' => [
                ['libelle' => 'Journal de badgeage QR Code', 'code' => null],
                ["libelle" => "Journal d'alerte retard (>15 min)", 'code' => null],
                ['libelle' => 'Export de paie', 'code' => null],
                ['libelle' => 'Règles HISSAP', 'code' => 'COM-RH-012'],
            ],
        ];
    }

    public function run(): void
    {
        foreach ($this->types() as $categorieCode => $types) {
            $categorie = CategorieDocument::where('code', $categorieCode)->first();
            if (!$categorie) {
                continue;
            }

            foreach ($types as $type) {
                TypeDocument::updateOrCreate(
                    ['categorie_id' => $categorie->id, 'libelle' => $type['libelle']],
                    ['code' => $type['code']]
                );
            }
        }
    }
}
