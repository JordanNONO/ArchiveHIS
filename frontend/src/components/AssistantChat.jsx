import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSparkles, LuX, LuSend, LuLoader2, LuRotateCcw } from 'react-icons/lu';
import { envoyerMessageAssistant, getHistoriqueAssistant, effacerHistoriqueAssistant } from '../api/routes/assistant';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Bulle de chat flottante, disponible sur toutes les pages du personnel
 * interne (montée une seule fois dans MainLayout.jsx, jamais pour un compte
 * dépôt — voir estCompteDepot là-bas). Volontairement en lecture seule : ne
 * fait que chercher/résumer des documents déjà archivés, jamais d'action
 * (créer, modifier, supprimer) — voir AssistantIAService côté backend.
 *
 * L'historique est persisté côté serveur par personne (voir
 * AssistantController/assistant_messages) — rechargé une seule fois à la
 * première ouverture de la bulle, pas à chaque montage du composant (inutile
 * tant que personne ne l'a ouverte).
 */
function AssistantChat() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [ouvert, setOuvert] = useState(false);
    const [messages, setMessages] = useState([]);
    const [historiqueCharge, setHistoriqueCharge] = useState(false);
    const [chargementHistorique, setChargementHistorique] = useState(false);
    const [saisie, setSaisie] = useState('');
    const [enCours, setEnCours] = useState(false);
    const finListeRef = useRef(null);

    useEffect(() => {
        if (ouvert) finListeRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, ouvert]);

    useEffect(() => {
        if (!ouvert || historiqueCharge) return;
        setChargementHistorique(true);
        getHistoriqueAssistant().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setMessages(data.map((m) => ({ role: m.role, contenu: m.contenu, documents: m.documents || [] })));
            }
        }).catch(() => {}).finally(() => {
            setHistoriqueCharge(true);
            setChargementHistorique(false);
        });
    }, [ouvert, historiqueCharge]);

    async function envoyer() {
        const texte = saisie.trim();
        if (!texte || enCours) return;

        setMessages((prev) => [...prev, { role: 'user', contenu: texte }]);
        setSaisie('');
        setEnCours(true);

        try {
            const res = await envoyerMessageAssistant(texte);
            const data = await res.json().catch(() => null);
            if (res.status === 200 && data) {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    contenu: data.reponse || t('assistant.reponseVide'),
                    documents: data.documents || [],
                    indisponible: data.disponible === false,
                }]);
            } else if (res.status === 429) {
                setMessages((prev) => [...prev, { role: 'assistant', contenu: t('assistant.limiteAtteinte'), indisponible: true }]);
            } else {
                setMessages((prev) => [...prev, { role: 'assistant', contenu: t('assistant.erreur'), indisponible: true }]);
            }
        } catch (error) {
            console.log(error);
            setMessages((prev) => [...prev, { role: 'assistant', contenu: t('assistant.erreur'), indisponible: true }]);
        } finally {
            setEnCours(false);
        }
    }

    async function nouvelleConversation() {
        if (messages.length === 0 || enCours) return;
        if (!await confirm({ message: t('assistant.confirmerEffacer'), danger: true, confirmLabel: t('assistant.effacer') })) return;
        try {
            await effacerHistoriqueAssistant();
        } catch (error) {
            console.log(error);
        }
        setMessages([]);
    }

    function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            envoyer();
        }
    }

    function ouvrirDocument(doc) {
        navigate(`/view/${doc.id}/${doc.extension || 'pdf'}`);
    }

    return (
        <>
            <button
                type='button'
                onClick={() => setOuvert((v) => !v)}
                aria-label={t('assistant.ouvrirAssistant')}
                className='fixed bottom-5 right-5 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors'
            >
                {ouvert ? <LuX size={22} /> : <LuSparkles size={22} />}
            </button>

            {ouvert && (
                <div className='fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm h-[32rem] max-h-[70vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden'>
                    <div className='flex items-center gap-2 px-4 py-3 border-b border-border shrink-0'>
                        <LuSparkles className='text-primary' size={18} />
                        <div className='flex-1 min-w-0'>
                            <p className='text-sm font-semibold truncate'>{t('assistant.titre')}</p>
                            <p className='text-xs text-muted-foreground truncate'>{t('assistant.sousTitre')}</p>
                        </div>
                        {messages.length > 0 && (
                            <button
                                type='button'
                                onClick={nouvelleConversation}
                                title={t('assistant.nouvelleConversation')}
                                className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
                            >
                                <LuRotateCcw size={15} />
                            </button>
                        )}
                    </div>

                    <div className='flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3'>
                        {chargementHistorique && (
                            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                                <LuLoader2 size={13} className='animate-spin' />
                                {t('assistant.chargementHistorique')}
                            </div>
                        )}
                        {!chargementHistorique && messages.length === 0 && (
                            <p className='text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2.5'>
                                {t('assistant.explication')}
                            </p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                                        m.role === 'user'
                                            ? 'bg-primary text-white rounded-br-sm'
                                            : `rounded-bl-sm ${m.indisponible ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`
                                    }`}
                                >
                                    {m.contenu}
                                </div>
                                {m.documents?.length > 0 && (
                                    <div className='w-full max-w-[88%] flex flex-col gap-1.5'>
                                        {m.documents.map((doc) => {
                                            const { icon: Icon, tint } = getFileTypeVisual(doc.extension);
                                            return (
                                                <button
                                                    key={doc.id}
                                                    type='button'
                                                    onClick={() => ouvrirDocument(doc)}
                                                    className='flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left hover:bg-muted/60 transition-colors'
                                                >
                                                    <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${tint}`}>
                                                        <Icon size={13} />
                                                    </span>
                                                    <span className='min-w-0 flex-1'>
                                                        <span className='block text-xs font-medium truncate'>{doc.titre}</span>
                                                        <span className='block text-[11px] text-muted-foreground truncate'>{doc.reference}{doc.categorie ? ` · ${doc.categorie}` : ''}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                        {enCours && (
                            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                                <LuLoader2 size={13} className='animate-spin' />
                                {t('assistant.enCours')}
                            </div>
                        )}
                        <div ref={finListeRef} />
                    </div>

                    <div className='flex items-center gap-2 px-3 py-2.5 border-t border-border shrink-0'>
                        <input
                            type='text'
                            value={saisie}
                            onChange={(e) => setSaisie(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder={t('assistant.placeholder')}
                            disabled={enCours}
                            className='flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60'
                        />
                        <button
                            type='button'
                            onClick={envoyer}
                            disabled={enCours || !saisie.trim()}
                            aria-label={t('assistant.envoyer')}
                            className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50'
                        >
                            <LuSend size={15} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default AssistantChat;
