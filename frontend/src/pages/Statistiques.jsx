import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { LuFileStack, LuCalendarClock, LuHourglass, LuTimer, LuFolderOpen, LuCheckCheck, LuClipboardCheck, LuMail, LuSend } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getStatistiques } from '../api/routes/statistiques';
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
          <ResponsiveContainer width='100%' height={Math.max(180, donnees.top_categories.length * 42)}>
            <BarChart
              data={donnees.top_categories.map((c) => ({ ...c, nom: nomCategorie(c, i18n.language) }))}
              layout='vertical'
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' horizontal={false} />
              <XAxis type='number' allowDecimals={false} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type='category' dataKey='nom' width={130} stroke='hsl(var(--muted-foreground))' fontSize={12} tickLine={false} axisLine={false} />
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

function Statistiques() {
  const { t, i18n } = useTranslation();
  const [donnees, setDonnees] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStatistiques()
      .then(async (res) => {
        if (res.status === 200) setDonnees(await res.json());
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, []);

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
          <SectionDocuments donnees={donnees} t={t} i18n={i18n} />
          <div className='grid lg:grid-cols-2 gap-4 mt-4'>
            <SectionSuiviDelai niveaux={donnees.suivis_delais_niveaux} t={t} />
            <SectionCourriers donnees={donnees.courriers} t={t} />
          </div>
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
