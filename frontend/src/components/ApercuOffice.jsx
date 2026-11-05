import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuAlertTriangle, LuDownload, LuLoader } from 'react-icons/lu';
import { getApercuOfficeConfig } from '../api/routes/document';

/**
 * Aperçu d'un document bureautique (Word, Excel, PowerPoint, OpenDocument)
 * dans la fiche document, rendu par le serveur OnlyOffice déjà utilisé pour
 * l'édition — voir EditionWord.jsx, dont ce composant reprend le mécanisme
 * de chargement du script.
 *
 * En LECTURE seule et sans verrou : consulter un tableur ne doit pas
 * empêcher quelqu'un d'autre de l'ouvrir (voir apercuOffice() côté serveur).
 *
 * Si le serveur OnlyOffice n'est pas configuré ou ne répond pas, on ne laisse
 * pas un cadre vide : on affiche la raison et le bouton de téléchargement,
 * qui reste le moyen sûr d'ouvrir le document.
 */
function ApercuOffice({ documentId, href, hauteurClasse = 'h-[70vh] lg:h-[90vh]' }) {
  const { t } = useTranslation();
  const conteneurRef = useRef(null);
  const editeurRef = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    // Identifiant unique : deux aperçus successifs ne doivent pas réutiliser
    // le même conteneur, OnlyOffice le vide à l'instanciation.
    const idConteneur = `apercu-office-${documentId}`;

    async function ouvrir() {
      setChargement(true);
      setErreur(null);

      const res = await getApercuOfficeConfig(documentId).catch(() => null);
      if (annule) return;
      if (!res || res.status !== 200) {
        const corps = await res?.json().catch(() => ({})) ?? {};
        setErreur(corps.error || t('docView.apercuIndisponible'));
        setChargement(false);
        return;
      }

      const { documentServerUrl, config } = await res.json();
      if (annule) return;

      const idScript = 'onlyoffice-api-script';
      const instancier = () => {
        if (annule) return;
        if (!window.DocsAPI || !conteneurRef.current) {
          setErreur(t('docView.apercuIndisponible'));
          setChargement(false);
          return;
        }
        editeurRef.current = new window.DocsAPI.DocEditor(idConteneur, {
          ...config,
          events: { onDocumentReady: () => !annule && setChargement(false) },
        });
      };

      if (!document.getElementById(idScript)) {
        const script = document.createElement('script');
        script.id = idScript;
        script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;
        script.onload = instancier;
        script.onerror = () => { if (!annule) { setErreur(t('docView.apercuIndisponible')); setChargement(false); } };
        document.body.appendChild(script);
      } else {
        instancier();
      }
    }

    ouvrir();
    return () => {
      annule = true;
      try { editeurRef.current?.destroyEditor?.(); } catch { /* éditeur déjà détruit */ }
    };
  }, [documentId, t]);

  if (erreur) {
    return (
      <div className='w-full flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 py-14 px-4 text-center'>
        <LuAlertTriangle size={22} className='text-amber-600' />
        <p className='text-sm text-foreground max-w-md'>{erreur}</p>
        {href && (
          <a href={href} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>
            <LuDownload size={15} /> {t('docView.telecharger')}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full ${hauteurClasse} rounded-lg overflow-hidden border border-border bg-muted`}>
      {chargement && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-card'>
          <LuLoader size={22} className='animate-spin text-muted-foreground' />
        </div>
      )}
      <div id={`apercu-office-${documentId}`} ref={conteneurRef} className='w-full h-full' />
    </div>
  );
}

export default ApercuOffice;
