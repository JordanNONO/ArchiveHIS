import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  LuFileStack, LuCalendarClock, LuHourglass, LuTimer, LuFolderOpen, LuCheckCheck, LuClipboardCheck, LuMail, LuSend,
  LuUsers, LuAlertTriangle, LuFilter,
} from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getStatistiques } from '../api/routes/statistiques';
import { getServicesMetier } from '../api/routes/serviceMetier';
import { nomCategorie } from '../utils/libelleLocalise';
import { STATUT_LABELS } from '../components/StatutBadge';

// Mêmes couleurs que StatutBadge (voir components/StatutBadge.jsx), en valeurs
// exploitables par recharts — les classes Tailwind ne fonctionnent pas comme
// fill/stroke, donc on reprend ici les mêmes tokens CSS (hsl(var(--x))) pour
// que le donut reste cohérent avec les badges de statut affichés ailleurs.
const STATUT_COULEURS = {
  SOUMIS: 'hsl(var(--secondary))',
  TRANSMIS_AU_SERVICE: 'hsl(var(--primary))',
  EN_COURS_DE_TRAITEMENT: 'hsl(var(--accent))',
  INCOMPLET_REJETE: 'hsl(var(--destructive))',
  VALIDE_ET_TRAITE: '#16a34a',
  ARCHIVE: '#71717a',
  EXPIRE_A_PURGER: 'hsl(var(--destructive) / 0.45)',
};

// Mêmes couleurs que la colonne "État" du Google Sheets remplacé, pour que
// l'équipe retrouve ses repères visuels habituels.
const ETAT_COURRIER_STYLES = {
  'Prélèvement': { couleur: '#eab308', labelKey: 'statistiques.etatPrelevement' },
  'En attente': { couleur: '#f59e0b', labelKey: 'statistiques.etatEnAttente' },
  'Payé': { couleur: '#16a34a', labelKey: 'statistiques.etatPaye' },
  'Enregistré': { couleur: '#3b82f6', labelKey: 'statistiques.etatEnregistre' },
  'Déposé': { couleur: '#a855f7', labelKey: 'statistiques.etatDepose' },
  'Traité': { couleur: '#64748b', labelKey: 'statistiques.etatTraite' },
  'N/C': { couleur: 'hsl(var(--muted-foreground))', labelKey: 'statistiques.etatNC' },
};

// Pipeline des objectifs PAI actifs (voir StatistiquesController::pai()) —
// même logique de gravité croissante que NIVEAU_STYLES (vert→orange→rouge),
// avec un 4e état "à venir" neutre avant que le rappel ne parte.
const PIPELINE_OBJECTIFS_STYLES = {
  a_venir: { couleur: 'hsl(var(--muted-foreground))', labelKey: 'statistiques.paiAVenir' },
  rappel_envoye: { couleur: 'hsl(var(--accent))', labelKey: 'statistiques.paiRappelEnvoye' },
  en_retard: { couleur: 'hsl(var(--destructive) / 0.6)', labelKey: 'statistiques.paiEnRetard' },
  escalade: { couleur: 'hsl(var(--destructive))', labelKey: 'statistiques.paiEscalade' },
};

const NIVEAU_STYLES = {
  VERT: { couleur: '#16a34a', tint: 'bg-green-500/10 text-green-600' },
  ORANGE: { couleur: 'hsl(var(--accent))', tint: 'bg-accent/20 text-accent-foreground' },
  ROUGE: { couleur: 'hsl(var(--destructive))', tint: 'bg-destructive/10 text-destructive' },
};

function formatDuree(heures, t, langue) {
  if (heures === null || heures === undefined) return t('statistiques.donneeIndisponible');
  if (heures < 24) {
    return `${heures.toLocaleString(langue, { maximumFractionDigits: 1 })} ${t('statistiques.heuresAbrev')}`;
  }
  return `${(heures / 24).toLocaleString(langue, { maximumFractionDigits: 1 })} ${t('statistiques.joursAbrev')}`;
}

function CarteStat({ icon: Icon, label, valeur, tint }) {
  return (
    <div className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tint}`}>
        <Icon size={19} />
      </div>
      <div className='min-w-0'>
        <p className='text-xl font-bold text-foreground leading-tight truncate'>{valeur}</p>
        <p className='text-xs text-muted-foreground truncate'>{label}</p>
      </div>
    </div>
  );
}

function ToolTipPersonnalise({ active, payload, label, formatterLabel, formatterValeur }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className='rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs'>
      <p className='font-medium text-foreground mb-0.5'>{formatterLabel ? formatterLabel(label) : label}</p>
      {payload.map((entree, i) => (
        <p key={i} className='text-muted-foreground'>
          {formatterValeur ? formatterValeur(entree) : entree.value}
        </p>
      ))}
    </div>
  );
}

/**
 * Tick Y personnalisé pour un BarChart horizontal : par défaut, un YAxis
 * catégoriel écrit le libellé sur une seule ligne dans sa largeur fixe et le
 * tronque silencieusement s'il dépasse (ex: "Comptabilité, Paie & Finance").
 * Ici le nom est réparti sur plusieurs lignes (tspans) au lieu d'être coupé —
 * le graphique reste un vrai BarChart recharts (animé, interactif, tooltip),
 * seul le rendu du libellé change.
 */
function TickNomEnveloppe({ x, y, payload }) {
  const LARGEUR_LIGNE = 20;
  const mots = String(payload.value).split(' ');
  const lignes = [];
  let ligneActuelle = '';
  for (const mot of mots) {
    const essai = ligneActuelle ? `${ligneActuelle} ${mot}` : mot;
    if (essai.length > LARGEUR_LIGNE && ligneActuelle) {
      lignes.push(ligneActuelle);
      ligneActuelle = mot;
    } else {
      ligneActuelle = essai;
    }
  }
  if (ligneActuelle) lignes.push(ligneActuelle);

  const hauteurLigne = 12;
  const decalageInitial = -((lignes.length - 1) * hauteurLigne) / 2;

  return (
    <text x={x} y={y} textAnchor='end' fontSize={11} fill='hsl(var(--muted-foreground))' dominantBaseline='middle'>
      {lignes.map((ligne, i) => (
        <tspan key={i} x={x} dy={i === 0 ? decalageInitial : hauteurLigne}>{ligne}</tspan>
      ))}
    </text>
  );
}

/**
 * Bloc "activité documentaire" — identique dans sa forme pour la vue globale
 * (tous les documents) et la section "Mes dépôts" de la vue personnelle
 * (mes documents à moi) : même forme de données côté API
 * (StatistiquesController::totaux/repartitionStatuts/volumeParMois/topCategories),
 * donc un seul composant pour les deux plutôt que deux mises en page à maintenir.
 */
function SectionDocuments({ titre, donnees, t, i18n }) {
  const formatMois = (mois) => new Date(`${mois}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
  const statutData = Object.entries(donnees.repartition_statuts)
    .map(([statut, total]) => ({ statut, total, label: t(STATUT_LABELS[statut] || statut) }))
    .filter((entree) => entree.total > 0);
  const totalStatuts = statutData.reduce((somme, e) => somme + e.total, 0);

  return (
    <>
      {titre && <h2 className='text-lg font-semibold text-foreground mb-3'>{titre}</h2>}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        <CarteStat icon={LuFileStack} label={t('statistiques.totalDocuments')} valeur={donnees.totaux.documents} tint='bg-primary/10 text-primary' />
        <CarteStat icon={LuCalendarClock} label={t('statistiques.documentsCeMois')} valeur={donnees.totaux.documents_ce_mois} tint='bg-secondary/10 text-secondary' />
        <CarteStat icon={LuHourglass} label={t('statistiques.enAttenteValidation')} valeur={donnees.totaux.en_attente_validation} tint='bg-accent/20 text-accent-foreground' />
        <CarteStat
          icon={LuTimer}
          label={t('statistiques.tempsMoyenValidation')}
          valeur={formatDuree(donnees.temps_moyen_validation_heures, t, i18n.language)}
          tint='bg-green-500/10 text-green-600'
        />
      </div>

      <div className='grid lg:grid-cols-5 gap-4 mb-4'>
        <div className='lg:col-span-3 rounded-2xl border border-border bg-card p-5'>
          <h3 className='text-sm font-semibold text-foreground mb-4'>{t('statistiques.volumeParMois')}</h3>
          <ResponsiveContainer width='100%' height={240}>
            <AreaChart data={donnees.volume_par_mois} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id='volumeGradient' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='hsl(var(--primary))' stopOpacity={0.35} />
                  <stop offset='95%' stopColor='hsl(var(--primary))' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' vertical={false} />
              <XAxis dataKey='mois' tickFormatter={formatMois} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                content={
                  <ToolTipPersonnalise
                    formatterLabel={formatMois}
                    formatterValeur={(e) => `${e.value} ${t('statistiques.documentsUnite')}`}
                  />
                }
              />
              <Area type='monotone' dataKey='total' stroke='hsl(var(--primary))' strokeWidth={2.5} fill='url(#volumeGradient)' />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className='lg:col-span-2 rounded-2xl border border-border bg-card p-5'>
          <h3 className='text-sm font-semibold text-foreground mb-2'>{t('statistiques.repartitionStatuts')}</h3>
          {statutData.length === 0 ? (
            <p className='text-sm text-muted-foreground py-16 text-center'>{t('statistiques.donneeIndisponible')}</p>
          ) : (
            <>
              <ResponsiveContainer width='100%' height={190}>
                <PieChart>
                  <Pie data={statutData} dataKey='total' nameKey='label' innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                    {statutData.map((entree) => (
                      <Cell key={entree.statut} fill={STATUT_COULEURS[entree.statut] || 'hsl(var(--muted-foreground))'} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ToolTipPersonnalise
                        formatterLabel={() => null}
                        formatterValeur={(e) => `${e.payload.label} — ${e.value} (${Math.round((e.value / totalStatuts) * 100)}%)`}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className='flex flex-col gap-1.5 mt-2'>
                {statutData.map((entree) => (
                  <div key={entree.statut} className='flex items-center gap-2 text-xs'>
                    <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: STATUT_COULEURS[entree.statut] }} />
                    <span className='text-muted-foreground truncate flex-1'>{entree.label}</span>
                    <span className='font-medium text-foreground'>{entree.total}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h3 className='text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5'>
          <LuFolderOpen size={15} className='text-muted-foreground' />
          {t('statistiques.topCategories')}
        </h3>
        {donnees.top_categories.length === 0 ? (
          <p className='text-sm text-muted-foreground py-10 text-center'>{t('statistiques.aucuneCategorie')}</p>
        ) : (
          <ResponsiveContainer width='100%' height={Math.max(180, donnees.top_categories.length * 50)}>
            <BarChart
              data={donnees.top_categories.map((c) => ({ ...c, nom: nomCategorie(c, i18n.language) }))}
              layout='vertical'
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' horizontal={false} />
              <XAxis type='number' allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type='category' dataKey='nom' width={150} tick={<TickNomEnveloppe />} tickLine={false} axisLine={false} />
              <Tooltip content={<ToolTipPersonnalise formatterLabel={(l) => l} formatterValeur={(e) => `${e.value} ${t('statistiques.documentsUnite')}`} />} />
              <Bar dataKey='total' fill='hsl(var(--primary))' radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

/**
 * Bloc "mes validations" — propre à la vue personnelle : distinct de "mes
 * dépôts", ça mesure les décisions que j'ai prises (Validé/traité ou
 * Incomplet/rejeté), pas les documents que j'ai moi-même déposés.
 */
function SectionValidations({ donnees, t, i18n }) {
  const formatMois = (mois) => new Date(`${mois}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
  const decisions = [
    { statut: 'VALIDE_ET_TRAITE', total: donnees.repartition_decisions.VALIDE_ET_TRAITE, label: t(STATUT_LABELS.VALIDE_ET_TRAITE) },
    { statut: 'INCOMPLET_REJETE', total: donnees.repartition_decisions.INCOMPLET_REJETE, label: t(STATUT_LABELS.INCOMPLET_REJETE) },
  ].filter((entree) => entree.total > 0);

  return (
    <>
      <h2 className='text-lg font-semibold text-foreground mb-3'>{t('statistiques.mesValidations')}</h2>
      <div className='grid grid-cols-2 gap-3 mb-4'>
        <CarteStat icon={LuClipboardCheck} label={t('statistiques.totalTraites')} valeur={donnees.totaux.total_traites} tint='bg-primary/10 text-primary' />
        <CarteStat icon={LuCheckCheck} label={t('statistiques.traitesCeMois')} valeur={donnees.totaux.traites_ce_mois} tint='bg-green-500/10 text-green-600' />
      </div>

      {donnees.totaux.total_traites === 0 ? (
        <div className='rounded-2xl border border-border bg-card p-5'>
          <p className='text-sm text-muted-foreground py-6 text-center'>{t('statistiques.aucuneValidation')}</p>
        </div>
      ) : (
        <div className='grid lg:grid-cols-5 gap-4'>
          <div className='lg:col-span-3 rounded-2xl border border-border bg-card p-5'>
            <h3 className='text-sm font-semibold text-foreground mb-4'>{t('statistiques.volumeParMois')}</h3>
            <ResponsiveContainer width='100%' height={220}>
              <AreaChart data={donnees.volume_par_mois} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id='validationGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#16a34a' stopOpacity={0.35} />
                    <stop offset='95%' stopColor='#16a34a' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' vertical={false} />
                <XAxis dataKey='mois' tickFormatter={formatMois} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ToolTipPersonnalise formatterLabel={formatMois} formatterValeur={(e) => `${e.value} ${t('statistiques.documentsUnite')}`} />} />
                <Area type='monotone' dataKey='total' stroke='#16a34a' strokeWidth={2.5} fill='url(#validationGradient)' />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className='lg:col-span-2 rounded-2xl border border-border bg-card p-5'>
            <h3 className='text-sm font-semibold text-foreground mb-2'>{t('statistiques.repartitionDecisions')}</h3>
            <ResponsiveContainer width='100%' height={190}>
              <PieChart>
                <Pie data={decisions} dataKey='total' nameKey='label' innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                  {decisions.map((entree) => (
                    <Cell key={entree.statut} fill={STATUT_COULEURS[entree.statut]} />
                  ))}
                </Pie>
                <Tooltip content={<ToolTipPersonnalise formatterLabel={() => null} formatterValeur={(e) => `${e.payload.label} — ${e.value}`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className='flex flex-col gap-1.5 mt-2'>
              {decisions.map((entree) => (
                <div key={entree.statut} className='flex items-center gap-2 text-xs'>
                  <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: STATUT_COULEURS[entree.statut] }} />
                  <span className='text-muted-foreground truncate flex-1'>{entree.label}</span>
                  <span className='font-medium text-foreground'>{entree.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Suivi de délai actif par niveau d'alerte — uniquement dans la vue globale,
 * c'est un indicateur de pilotage d'entreprise (voir StatistiquesController).
 */
function SectionSuiviDelai({ niveaux, t }) {
  const total = Object.values(niveaux).reduce((a, b) => a + b, 0);

  return (
    <div className='rounded-2xl border border-border bg-card p-5'>
      <h3 className='text-sm font-semibold text-foreground mb-4'>{t('statistiques.suiviDelaisNiveaux')}</h3>
      {total === 0 ? (
        <p className='text-sm text-muted-foreground py-10 text-center'>{t('statistiques.aucunSuiviActif')}</p>
      ) : (
        <>
          <div className='flex w-full h-2.5 rounded-full overflow-hidden bg-muted mb-4'>
            {['VERT', 'ORANGE', 'ROUGE'].map((niveau) => {
              const valeur = niveaux[niveau];
              if (valeur === 0) return null;
              return <div key={niveau} style={{ width: `${(valeur / total) * 100}%`, backgroundColor: NIVEAU_STYLES[niveau].couleur }} />;
            })}
          </div>
          <div className='flex flex-col gap-3'>
            {['VERT', 'ORANGE', 'ROUGE'].map((niveau) => (
              <div key={niveau} className='flex items-center gap-3'>
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${NIVEAU_STYLES[niveau].tint}`}>
                  <span className='w-2.5 h-2.5 rounded-full' style={{ backgroundColor: NIVEAU_STYLES[niveau].couleur }} />
                </span>
                <span className='text-sm text-muted-foreground flex-1'>{t(`statistiques.niveau${niveau.charAt(0)}${niveau.slice(1).toLowerCase()}`)}</span>
                <span className='text-sm font-semibold text-foreground'>{niveaux[niveau]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Volumes entrants/sortants et répartition par état des courriers entrants
 * (voir CourrierForm.jsx / RelancerCourriersEnAttente) — uniquement dans la
 * vue globale, même raison que SectionSuiviDelai.
 */
function SectionCourriers({ donnees, t }) {
  const etats = Object.entries(donnees.repartition_etat)
    .map(([cle, total]) => ({ cle, total, ...ETAT_COURRIER_STYLES[cle] }))
    .filter((e) => e.total > 0);
  const totalEtats = etats.reduce((somme, e) => somme + e.total, 0);

  return (
    <div className='rounded-2xl border border-border bg-card p-5'>
      <h3 className='text-sm font-semibold text-foreground mb-4'>{t('statistiques.courriers')}</h3>
      <div className='grid grid-cols-2 gap-3 mb-4'>
        <CarteStat icon={LuMail} label={t('statistiques.totalEntrants')} valeur={donnees.total_entrants} tint='bg-primary/10 text-primary' />
        <CarteStat icon={LuSend} label={t('statistiques.totalSortants')} valeur={donnees.total_sortants} tint='bg-secondary/10 text-secondary' />
      </div>
      {totalEtats === 0 ? (
        <p className='text-sm text-muted-foreground py-4 text-center'>{t('statistiques.aucunCourrierSuivi')}</p>
      ) : (
        <>
          <div className='flex w-full h-2.5 rounded-full overflow-hidden bg-muted mb-3'>
            {etats.map((e) => (
              <div key={e.cle} style={{ width: `${(e.total / totalEtats) * 100}%`, backgroundColor: e.couleur }} />
            ))}
          </div>
          <div className='flex flex-col gap-2'>
            {etats.map((e) => (
              <div key={e.cle} className='flex items-center gap-2 text-xs'>
                <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: e.couleur }} />
                <span className='text-muted-foreground flex-1'>{t(e.labelKey)}</span>
                <span className='font-medium text-foreground'>{e.total}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * PAI (projets d'accompagnement individualisé) — dossiers ouverts/clôturés,
 * pipeline des objectifs actifs, et répartition par responsable de secteur
 * (voir StatistiquesController::pai()). Vue globale uniquement.
 */
function SectionPai({ donnees, t, i18n }) {
  const formatMois = (mois) => new Date(`${mois}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
  const pipeline = Object.entries(donnees.pipeline_objectifs)
    .map(([cle, total]) => ({ cle, total, ...PIPELINE_OBJECTIFS_STYLES[cle] }))
    .filter((e) => e.total > 0);
  const totalPipeline = pipeline.reduce((somme, e) => somme + e.total, 0);

  return (
    <>
      <h2 className='text-lg font-semibold text-foreground mb-3'>{t('statistiques.pai')}</h2>
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        <CarteStat icon={LuFolderOpen} label={t('statistiques.paiDossiersOuverts')} valeur={donnees.dossiers_ouverts} tint='bg-primary/10 text-primary' />
        <CarteStat icon={LuCheckCheck} label={t('statistiques.paiDossiersClotures')} valeur={donnees.dossiers_clotures} tint='bg-green-500/10 text-green-600' />
        <CarteStat icon={LuClipboardCheck} label={t('statistiques.paiObjectifsFaits')} valeur={donnees.objectifs_faits} tint='bg-secondary/10 text-secondary' />
        <CarteStat icon={LuAlertTriangle} label={t('statistiques.paiObjectifsEnRetard')} valeur={donnees.objectifs_en_retard} tint='bg-destructive/10 text-destructive' />
      </div>

      <div className='grid lg:grid-cols-5 gap-4 mb-4'>
        <div className='lg:col-span-3 rounded-2xl border border-border bg-card p-5'>
          <h3 className='text-sm font-semibold text-foreground mb-4'>{t('statistiques.paiVolumeParMois')}</h3>
          <ResponsiveContainer width='100%' height={220}>
            <AreaChart data={donnees.volume_par_mois} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id='paiGradient' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='hsl(var(--secondary))' stopOpacity={0.35} />
                  <stop offset='95%' stopColor='hsl(var(--secondary))' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' vertical={false} />
              <XAxis dataKey='mois' tickFormatter={formatMois} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ToolTipPersonnalise formatterLabel={formatMois} formatterValeur={(e) => `${e.value} ${t('statistiques.paiDossiersUnite')}`} />} />
              <Area type='monotone' dataKey='total' stroke='hsl(var(--secondary))' strokeWidth={2.5} fill='url(#paiGradient)' />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className='lg:col-span-2 rounded-2xl border border-border bg-card p-5'>
          <h3 className='text-sm font-semibold text-foreground mb-2'>{t('statistiques.paiPipelineObjectifs')}</h3>
          {totalPipeline === 0 ? (
            <p className='text-sm text-muted-foreground py-16 text-center'>{t('statistiques.donneeIndisponible')}</p>
          ) : (
            <>
              <ResponsiveContainer width='100%' height={190}>
                <PieChart>
                  <Pie data={pipeline} dataKey='total' nameKey='cle' innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                    {pipeline.map((e) => <Cell key={e.cle} fill={e.couleur} />)}
                  </Pie>
                  <Tooltip content={<ToolTipPersonnalise formatterLabel={() => null} formatterValeur={(e) => `${t(e.payload.labelKey)} — ${e.value}`} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className='flex flex-col gap-1.5 mt-2'>
                {pipeline.map((e) => (
                  <div key={e.cle} className='flex items-center gap-2 text-xs'>
                    <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: e.couleur }} />
                    <span className='text-muted-foreground truncate flex-1'>{t(e.labelKey)}</span>
                    <span className='font-medium text-foreground'>{e.total}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h3 className='text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5'>
          <LuUsers size={15} className='text-muted-foreground' />
          {t('statistiques.paiParResponsable')}
        </h3>
        {donnees.par_responsable.length === 0 ? (
          <p className='text-sm text-muted-foreground py-10 text-center'>{t('statistiques.aucuneDonnee')}</p>
        ) : (
          <ResponsiveContainer width='100%' height={Math.max(140, donnees.par_responsable.length * 42)}>
            <BarChart data={donnees.par_responsable} layout='vertical' margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' horizontal={false} />
              <XAxis type='number' allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type='category' dataKey='nom' width={130} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<ToolTipPersonnalise formatterLabel={(l) => l} formatterValeur={(e) => `${e.value} ${t('statistiques.paiDossiersUnite')}`} />} />
              <Bar dataKey='total' fill='hsl(var(--secondary))' radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

// Palette tournante pour des répartitions à nombre de tranches variable (rôles,
// services) — contrairement aux donuts existants (statuts, courriers...) dont
// les clés sont fixes et connues à l'avance.
const PALETTE_ROTATIVE = [
  'hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#16a34a',
  '#a855f7', '#3b82f6', '#eab308', '#64748b', '#ec4899', '#14b8a6',
];

/**
 * Donut + légende pour une répartition à clés variables (voir PALETTE_ROTATIVE) —
 * factorisé puisque "par rôle" et "par service" partagent exactement la même forme.
 */
function DonutRepartition({ data, t }) {
  const total = data.reduce((somme, e) => somme + e.total, 0);
  if (data.length === 0) {
    return <p className='text-sm text-muted-foreground py-8 text-center'>{t('statistiques.aucuneDonnee')}</p>;
  }
  return (
    <>
      <ResponsiveContainer width='100%' height={190}>
        <PieChart>
          <Pie data={data} dataKey='total' nameKey='nom' innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}>
            {data.map((e, i) => <Cell key={e.nom} fill={PALETTE_ROTATIVE[i % PALETTE_ROTATIVE.length]} />)}
          </Pie>
          <Tooltip
            content={
              <ToolTipPersonnalise
                formatterLabel={() => null}
                formatterValeur={(e) => `${e.payload.nom} — ${e.value} (${Math.round((e.value / total) * 100)}%)`}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className='flex flex-col gap-1.5 mt-2 max-h-32 overflow-y-auto pr-1'>
        {data.map((e, i) => (
          <div key={e.nom} className='flex items-center gap-2 text-xs'>
            <span className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: PALETTE_ROTATIVE[i % PALETTE_ROTATIVE.length] }} />
            <span className='text-muted-foreground truncate flex-1'>{e.nom}</span>
            <span className='font-medium text-foreground'>{e.total}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Personnel interne — répartition par rôle et par service (voir
 * StatistiquesController::personnel()).
 */
function SectionPersonnel({ donnees, t }) {
  return (
    <div className='rounded-2xl border border-border bg-card p-5'>
      <h3 className='text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5'>
        <LuUsers size={15} className='text-muted-foreground' />
        {t('statistiques.personnel')}
      </h3>
      <div className='mb-4'>
        <CarteStat icon={LuUsers} label={t('statistiques.personnelTotal')} valeur={donnees.total_interne} tint='bg-primary/10 text-primary' />
      </div>
      <div className='grid sm:grid-cols-2 gap-4'>
        <div>
          <p className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2'>{t('statistiques.personnelParRole')}</p>
          <DonutRepartition data={donnees.par_role} t={t} />
        </div>
        <div>
          <p className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2'>{t('statistiques.personnelParService')}</p>
          <DonutRepartition data={donnees.par_service} t={t} />
        </div>
      </div>
    </div>
  );
}

/**
 * Barre de filtres (période + service métier) — vue globale uniquement, seule
 * page de l'appli à filtrer côté serveur plutôt que côté client (l'agrégation
 * SQL doit refaire la requête). Même style que DossierToolbar.jsx pour rester
 * cohérent avec le reste de l'appli.
 */
function FiltresStatistiques({ dateDebut, setDateDebut, dateFin, setDateFin, serviceMetierId, setServiceMetierId, servicesMetier, t }) {
  const filtreActif = dateDebut || dateFin || serviceMetierId;

  return (
    <div className='flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 mb-5'>
      <div className='flex items-center gap-1.5 text-muted-foreground shrink-0'>
        <LuFilter size={15} />
        <span className='text-xs font-medium'>{t('statistiques.filtrerPar')}</span>
      </div>
      <div className='flex items-center gap-1.5'>
        <label className='text-xs text-muted-foreground'>{t('statistiques.filtreDu')}</label>
        <input
          type='date'
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
          className='input input-bordered input-sm rounded-lg text-sm'
        />
      </div>
      <div className='flex items-center gap-1.5'>
        <label className='text-xs text-muted-foreground'>{t('statistiques.filtreAu')}</label>
        <input
          type='date'
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
          className='input input-bordered input-sm rounded-lg text-sm'
        />
      </div>
      <select
        value={serviceMetierId}
        onChange={(e) => setServiceMetierId(e.target.value)}
        className='select select-bordered select-sm rounded-lg text-sm font-normal'
      >
        <option value=''>{t('statistiques.filtreTousServices')}</option>
        {servicesMetier.map((s) => (
          <option key={s.id} value={s.id}>{s.nom_service}</option>
        ))}
      </select>
      {filtreActif && (
        <button
          type='button'
          onClick={() => { setDateDebut(''); setDateFin(''); setServiceMetierId(''); }}
          className='text-xs text-primary font-medium hover:underline'
        >
          {t('statistiques.filtreReinitialiser')}
        </button>
      )}
    </div>
  );
}

function Statistiques() {
  const { t, i18n } = useTranslation();
  const [donnees, setDonnees] = useState(null);
  const [loading, setLoading] = useState(true);
  // Filtres (vue globale uniquement) — voir FiltresStatistiques.
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [serviceMetierId, setServiceMetierId] = useState('');
  const [servicesMetier, setServicesMetier] = useState([]);

  useEffect(() => {
    getServicesMetier()
      .then(async (res) => { if (res.status === 200) setServicesMetier(await res.json()); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getStatistiques({ date_debut: dateDebut, date_fin: dateFin, service_metier_id: serviceMetierId })
      .then(async (res) => {
        if (res.status === 200) setDonnees(await res.json());
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, [dateDebut, dateFin, serviceMetierId]);

  if (loading) return <Loading />;
  if (!donnees) return null;

  const estVueGlobale = donnees.portee === 'globale';

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where={t('statistiques.titre')} />
      <div className='mb-5 mt-1'>
        <h2 className='text-2xl font-semibold text-foreground'>{t('statistiques.titre')}</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          {estVueGlobale ? t('statistiques.sousTitreGlobale') : t('statistiques.sousTitrePersonnelle')}
        </p>
      </div>

      {estVueGlobale ? (
        <>
          <FiltresStatistiques
            dateDebut={dateDebut} setDateDebut={setDateDebut}
            dateFin={dateFin} setDateFin={setDateFin}
            serviceMetierId={serviceMetierId} setServiceMetierId={setServiceMetierId}
            servicesMetier={servicesMetier} t={t}
          />

          <SectionDocuments donnees={donnees} t={t} i18n={i18n} />
          <div className='grid lg:grid-cols-2 gap-4 mt-4 mb-6'>
            <SectionSuiviDelai niveaux={donnees.suivis_delais_niveaux} t={t} />
            <SectionCourriers donnees={donnees.courriers} t={t} />
          </div>

          <div className='mb-6'>
            <SectionPai donnees={donnees.pai} t={t} i18n={i18n} />
          </div>

          <SectionPersonnel donnees={donnees.personnel} t={t} />
        </>
      ) : (
        <>
          <div className='mb-6'>
            <SectionDocuments titre={t('statistiques.mesDepots')} donnees={donnees.mes_depots} t={t} i18n={i18n} />
          </div>
          <SectionValidations donnees={donnees.mes_validations} t={t} i18n={i18n} />
        </>
      )}
    </div>
  );
}

export default Statistiques;
