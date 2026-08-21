import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LuRefreshCw, LuEye, LuActivity } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getActivite } from '../api/routes/activite';

const TYPE_VISUAL = {
  statut: { icon: LuRefreshCw, tint: 'bg-primary/10 text-primary' },
  consultation: { icon: LuEye, tint: 'bg-secondary/10 text-secondary' },
};

function Activite() {
  const { t, i18n } = useTranslation();

  function nomUtilisateur(u) {
    const p = u?.personnels?.[0];
    if (p) return `${p.prenom || ''} ${p.nom || ''}`.trim();
    return u?.nom || t('activite.unUtilisateur');
  }

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActivite(100)
      .then(async (res) => {
        if (res.status === 200) setItems(await res.json());
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where={t('sidebar.activite')} />
      <div className='mb-4 mt-1'>
        <h2 className='text-2xl font-semibold text-foreground'>{t('sidebar.activite')}</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          {t('activite.sousTitre')}
        </p>
      </div>

      {loading ? <Loading /> : (
        <div className='rounded-2xl border border-border bg-card p-4'>
          <ul className='flex flex-col'>
            {items.map((item, idx) => {
              const { icon: Icon, tint } = TYPE_VISUAL[item.type] || TYPE_VISUAL.statut;
              const isLast = idx === items.length - 1;
              return (
                <li key={idx} className='flex gap-3'>
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
                      {new Date(item.date).toLocaleString(i18n.language)}
                    </div>
                  </div>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className='flex flex-col items-center gap-2 py-10 text-muted-foreground'>
                <LuActivity size={28} />
                <span>{t('activite.aucuneActivite')}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Activite;
