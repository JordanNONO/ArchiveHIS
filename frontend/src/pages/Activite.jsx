import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { LuRefreshCw, LuEye, LuActivity } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import Pagination from '../components/Pagination';
import { getActivite } from '../api/routes/activite';

const TYPE_VISUAL = {
  statut: { icon: LuRefreshCw, tint: 'bg-primary/10 text-primary' },
  consultation: { icon: LuEye, tint: 'bg-secondary/10 text-secondary' },
};

const ENTREES_PAR_PAGE = 25;

function Activite() {
  const { t, i18n } = useTranslation();

  function nomUtilisateur(u) {
    const p = u?.personnels?.[0];
    if (p) return `${p.prenom || ''} ${p.nom || ''}`.trim();
    return u?.nom || t('activite.unUtilisateur');
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // Filtre par type + pagination : les ~200 entrées tenaient sur une seule
  // page interminable, sans moyen de ne voir que les changements de statut.
  const [filtreType, setFiltreType] = useState(searchParams.get('type') || 'tous');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Ouvrir un document lié (lien ci-dessous) démonte cette page — au retour,
  // elle remontait de zéro et le filtre/la page repartaient par défaut
  // (retour utilisateur : "c'est comme ça partout"). Même principe que
  // OpenFolder.jsx/FluctuationRh.jsx : l'état vit dans l'URL.
  useEffect(() => {
    const params = {};
    if (filtreType !== 'tous') params.type = filtreType;
    if (page !== 1) params.page = String(page);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreType, page]);

  useEffect(() => {
    setLoading(true);
    getActivite(200)
      .then(async (res) => {
        if (res.status === 200) setItems(await res.json());
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  // Tri garanti côté client aussi (le serveur trie déjà, mais un fil mal
  // ordonné est trop trompeur pour dépendre d'un seul endroit).
  const filtres = items
    .filter((item) => filtreType === 'tous' || item.type === filtreType)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPages = Math.ceil(filtres.length / ENTREES_PAR_PAGE);
  const pageAffichee = Math.max(1, Math.min(page, totalPages));
  const visibles = filtres.slice((pageAffichee - 1) * ENTREES_PAR_PAGE, pageAffichee * ENTREES_PAR_PAGE);

  const filtresType = [
    { value: 'tous', label: t('activite.filtreTous', 'Tout') },
    { value: 'statut', label: t('activite.filtreStatuts', 'Changements de statut') },
    { value: 'consultation', label: t('activite.filtreConsultations', 'Consultations') },
  ];

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where={t('sidebar.activite')} />
      <div className='mb-4 mt-1'>
        <h2 className='text-2xl font-semibold text-foreground'>{t('sidebar.activite')}</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          {t('activite.sousTitre')}
        </p>
      </div>

      <div className='flex flex-wrap gap-2 mb-3'>
        {filtresType.map((f) => (
          <button
            key={f.value}
            type='button'
            onClick={() => { setFiltreType(f.value); setPage(1); }}
            aria-pressed={filtreType === f.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${filtreType === f.value ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div className='rounded-2xl border border-border bg-card p-4'>
          <ul className='flex flex-col'>
            {visibles.map((item, idx) => {
              const { icon: Icon, tint } = TYPE_VISUAL[item.type] || TYPE_VISUAL.statut;
              const isLast = idx === visibles.length - 1;
              return (
                <li key={`${item.type}-${item.date}-${idx}`} className='flex gap-3'>
                  <div className='flex flex-col items-center'>
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${tint}`}>
                      <Icon size={14} />
                    </span>
                    {!isLast && <span className='w-px flex-1 bg-border my-1' />}
                  </div>
                  <div className={`min-w-0 text-sm ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <div>
                      <span className='font-medium'>{nomUtilisateur(item.utilisateur)}</span>
                      {' — '}
                      <span className='text-muted-foreground'>{item.description}</span>
                    </div>
                    {item.document && (
                      <Link to={`/view/${item.document.id}/${item.document.extension || 'pdf'}`} className='text-sm text-primary hover:underline'>
                        {item.document.titre}
                      </Link>
                    )}
                    <div className='text-muted-foreground text-xs mt-0.5'>
                      {new Date(item.date).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </li>
              );
            })}
            {visibles.length === 0 && (
              <li className='flex flex-col items-center gap-2 py-10 text-muted-foreground'>
                <LuActivity size={28} />
                <span>{t('activite.aucuneActivite')}</span>
              </li>
            )}
          </ul>
        </div>
      )}
      <Pagination currentPage={pageAffichee} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

export default Activite;
