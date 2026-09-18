import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuSparkles, LuX, LuSend, LuLoader2, LuRotateCcw, LuMic, LuSquare, LuVolume2, LuVolumeX } from 'react-icons/lu';
import { envoyerMessageAssistant, getHistoriqueAssistant, effacerHistoriqueAssistant } from '../api/routes/assistant';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { usePermissions } from '../hooks/usePermissions';

// Même API navigateur que VoiceRecorder.jsx (Web Speech API) — mais ici en
// dictée directe dans le champ texte, pas d'enregistrement audio à conserver :
// l'assistant n'a besoin que du texte de la question, jamais du fichier son.
const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// Codes BCP-47 pour les 5 langues de l'appli (voir i18n/locales) — la dictée
// suit la langue d'interface de la personne connectée plutôt qu'un choix
// séparé, contrairement à VoiceRecorder.jsx (pensé pour un bénéficiaire externe
// dont la langue n'est pas forcément celle de l'interface).
const LANGUE_DICTEE = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', ar: 'ar-SA' };

// Filet de sécurité : coupe la dictée toute seule si elle traîne trop
// longtemps (oubli de cliquer sur arrêter, bruit ambiant qui la relance sans
// fin) — 60s est largement suffisant pour une question, contre 180s pour un
// vrai message vocal enregistré (VoiceRecorder.jsx).
const DUREE_MAX_DICTEE_MS = 60000;

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
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { hasPermission, isAdministrator } = usePermissions();
    const autoriseRedaction = isAdministrator || hasPermission('assistant_redaction');
    const [ouvert, setOuvert] = useState(false);
    const [messages, setMessages] = useState([]);
    const [historiqueCharge, setHistoriqueCharge] = useState(false);
    const [chargementHistorique, setChargementHistorique] = useState(false);
    const [saisie, setSaisie] = useState('');
    const [enCours, setEnCours] = useState(false);
    const [ecoute, setEcoute] = useState(false);
    // id (pas l'index du tableau, plus fiable si la liste bouge) du message
    // assistant en train d'être lu à voix haute, ou null — pilote l'icône
    // haut-parleur/stop sur chaque bulle et l'indicateur "en train de parler".
    const [messageEnLecture, setMessageEnLecture] = useState(null);
    const finListeRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const prefixeDicteeRef = useRef('');
    const dicteeTimeoutRef = useRef(null);
    const idCompteurRef = useRef(0);
    function nouvelId() {
        idCompteurRef.current += 1;
        return idCompteurRef.current;
    }
    // Messages tapés/dictés pendant qu'une réponse précédente était encore en
    // cours — jamais envoyés en parallèle (voir traiterMessage()) : la
    // question suivante part automatiquement dès que la précédente a
    // répondu, sans annuler ni dupliquer aucun appel. C'est ce qui permet de
    // "dialoguer" sans attendre chaque réponse, sans jamais gaspiller un seul
    // appel à Claude (rien n'est jamais interrompu en cours de route).
    const fileAttenteRef = useRef([]);
    // true si le texte actuellement dans le champ vient de la dictée (pas
    // retapé/modifié au clavier depuis) — c'est ce qui décide si la réponse
    // sera lue à voix haute automatiquement (voir envoyer()) : un aller-retour
    // vocal complet façon ChatGPT quand on a posé la question à l'oral, mais
    // jamais de lecture imposée quand on tape, pour ne pas gêner en bureau partagé.
    const derniereSaisieVoixRef = useRef(false);

    useEffect(() => () => {
        try { recognitionRef.current?.stop(); } catch { /* déjà arrêté */ }
        try { window.speechSynthesis?.cancel(); } catch { /* pas supporté */ }
        clearTimeout(dicteeTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (ouvert) finListeRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, ouvert]);

    // Champ qui grandit avec le texte (jusqu'à ~6 lignes, puis défile) — pour
    // qu'un message un peu long reste entièrement lisible pendant la saisie,
    // au lieu de défiler horizontalement dans un simple <input> d'une ligne.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 144) + 'px';
    }, [saisie]);

    useEffect(() => {
        if (!ouvert || historiqueCharge) return;
        setChargementHistorique(true);
        getHistoriqueAssistant().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setMessages(data.map((m) => ({ id: nouvelId(), role: m.role, contenu: m.contenu, documents: m.documents || [] })));
            }
        }).catch(() => {}).finally(() => {
            setHistoriqueCharge(true);
            setChargementHistorique(false);
        });
    }, [ouvert, historiqueCharge]);

    // Chrome coupe parfois net une lecture trop longue en un seul bloc (bug
    // connu de l'API SpeechSynthesis) — découper par phrase et enchaîner
    // plusieurs lectures courtes est beaucoup plus fiable. Retire aussi la
    // ponctuation markdown (*, #, `...) que Claude peut renvoyer, sinon elle
    // s'entend telle quelle ("étoile étoile important étoile étoile").
    function lireAVoixHaute(texte, id) {
        if (!('speechSynthesis' in window) || !texte) return;
        try {
            window.speechSynthesis.cancel();
            const segments = texte
                .replace(/[*_#`~]/g, '')
                .split(/(?<=[.!?:])\s+|\n+/)
                .map((s) => s.trim())
                .filter(Boolean);
            if (segments.length === 0) return;
            const langue = LANGUE_DICTEE[i18n.language] || 'fr-FR';
            setMessageEnLecture(id);
            segments.forEach((segment, i) => {
                const enonce = new SpeechSynthesisUtterance(segment);
                enonce.lang = langue;
                if (i === segments.length - 1) {
                    enonce.onend = () => setMessageEnLecture((cur) => (cur === id ? null : cur));
                    enonce.onerror = () => setMessageEnLecture((cur) => (cur === id ? null : cur));
                }
                window.speechSynthesis.speak(enonce);
            });
        } catch { setMessageEnLecture(null); }
    }

    function arreterLecture() {
        try { window.speechSynthesis?.cancel(); } catch { /* pas supporté */ }
        setMessageEnLecture(null);
    }

    function basculerLecture(message) {
        if (messageEnLecture === message.id) {
            arreterLecture();
        } else {
            lireAVoixHaute(message.contenu, message.id);
        }
    }

    async function traiterMessage(texte, parVoix) {
        setEnCours(true);
        try {
            const res = await envoyerMessageAssistant(texte);
            const data = await res.json().catch(() => null);
            if (res.status === 200 && data) {
                const reponse = data.reponse || t('assistant.reponseVide');
                const id = nouvelId();
                setMessages((prev) => [...prev, {
                    id,
                    role: 'assistant',
                    contenu: reponse,
                    documents: data.documents || [],
                    indisponible: data.disponible === false,
                }]);
                if (parVoix && data.disponible !== false) lireAVoixHaute(reponse, id);
            } else if (res.status === 429) {
                setMessages((prev) => [...prev, { id: nouvelId(), role: 'assistant', contenu: t('assistant.limiteAtteinte'), indisponible: true }]);
            } else {
                setMessages((prev) => [...prev, { id: nouvelId(), role: 'assistant', contenu: t('assistant.erreur'), indisponible: true }]);
            }
        } catch (error) {
            console.log(error);
            setMessages((prev) => [...prev, { id: nouvelId(), role: 'assistant', contenu: t('assistant.erreur'), indisponible: true }]);
        } finally {
            setEnCours(false);
        }

        // Une question posée pendant qu'on attendait déjà cette réponse ?
        // On l'enchaîne maintenant, jamais avant que celle-ci soit finie.
        const suivant = fileAttenteRef.current.shift();
        if (suivant) await traiterMessage(suivant.texte, suivant.parVoix);
    }

    async function envoyer() {
        const texte = saisie.trim();
        if (!texte) return;
        // Le micro ne s'arrêtait jamais tout seul en envoyant la question —
        // il continuait d'écouter pendant que l'assistant réfléchissait puis
        // répondait (et pouvait donc capter sa propre voix relue, en plus de
        // continuer à modifier le champ après l'envoi). Un envoi ARRÊTE
        // toujours la dictée en cours, comme si on avait cliqué sur le bouton.
        if (ecoute) arreterDictee();
        const parVoix = derniereSaisieVoixRef.current;
        derniereSaisieVoixRef.current = false;
        setSaisie('');
        setMessages((prev) => [...prev, { id: nouvelId(), role: 'user', contenu: texte }]);

        // Une réponse est déjà en cours : cette question rejoint la file au
        // lieu de partir en même temps (jamais deux appels en parallèle, pour
        // ne jamais mélanger l'ordre de la conversation ni payer un appel en
        // double) — elle part automatiquement dès que la précédente répond.
        if (enCours) {
            fileAttenteRef.current.push({ texte, parVoix });
            return;
        }
        await traiterMessage(texte, parVoix);
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

    function demarrerDictee() {
        if (!SpeechRecognitionImpl || ecoute) return;
        // Coupe une éventuelle lecture de réponse en cours — sinon le micro
        // risque de capter la voix de l'assistant lui-même.
        try { window.speechSynthesis?.cancel(); } catch { /* pas supporté */ }
        setMessageEnLecture(null);
        const reco = new SpeechRecognitionImpl();
        reco.lang = LANGUE_DICTEE[i18n.language] || 'fr-FR';
        reco.continuous = true;
        reco.interimResults = true;
        prefixeDicteeRef.current = saisie.trim();
        derniereSaisieVoixRef.current = true;
        reco.onresult = (e) => {
            let texteSession = '';
            for (let i = 0; i < e.results.length; i++) texteSession += e.results[i][0].transcript;
            const prefixe = prefixeDicteeRef.current;
            setSaisie(prefixe ? `${prefixe} ${texteSession}` : texteSession);
        };
        reco.onerror = (e) => {
            setEcoute(false);
            // 'aborted' = on a nous-même appelé stop() (bouton, minuterie) —
            // pas une vraie erreur, rien à signaler. Le reste mérite un mot,
            // sinon le micro s'éteint sans explication.
            if (e.error === 'aborted') return;
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                toast.error(t('assistant.microphoneRefuse'));
            } else if (e.error === 'audio-capture') {
                toast.error(t('assistant.microphoneIntrouvable'));
            } else if (e.error !== 'no-speech') {
                toast.error(t('assistant.erreurDictee'));
            }
        };
        reco.onend = () => {
            setEcoute(false);
            clearTimeout(dicteeTimeoutRef.current);
        };
        try {
            reco.start();
            recognitionRef.current = reco;
            setEcoute(true);
            dicteeTimeoutRef.current = setTimeout(arreterDictee, DUREE_MAX_DICTEE_MS);
        } catch {
            setEcoute(false);
        }
    }

    function arreterDictee() {
        clearTimeout(dicteeTimeoutRef.current);
        try { recognitionRef.current?.stop(); } catch { /* déjà arrêté */ }
        setEcoute(false);
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
                                {t(autoriseRedaction ? 'assistant.explicationAvecRedaction' : 'assistant.explication')}
                            </p>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className='flex items-end gap-1.5 max-w-[88%]'>
                                    <div
                                        className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                                            m.role === 'user'
                                                ? 'bg-primary text-white rounded-br-sm'
                                                : `rounded-bl-sm ${m.indisponible ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`
                                        }`}
                                    >
                                        {m.contenu}
                                    </div>
                                    {m.role === 'assistant' && !m.indisponible && 'speechSynthesis' in window && (
                                        <button
                                            type='button'
                                            onClick={() => basculerLecture(m)}
                                            title={messageEnLecture === m.id ? t('assistant.arreterLecture') : t('assistant.ecouterReponse')}
                                            className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${messageEnLecture === m.id ? 'text-primary animate-pulse' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                        >
                                            {messageEnLecture === m.id ? <LuVolumeX size={14} /> : <LuVolume2 size={14} />}
                                        </button>
                                    )}
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

                    <div className='flex items-end gap-2 px-3 py-2.5 border-t border-border shrink-0'>
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={saisie}
                            onChange={(e) => { derniereSaisieVoixRef.current = false; setSaisie(e.target.value); }}
                            onKeyDown={onKeyDown}
                            placeholder={t('assistant.placeholder')}
                            className='flex-1 min-w-0 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-snug focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60'
                        />
                        {SpeechRecognitionImpl && (
                            <button
                                type='button'
                                onClick={ecoute ? arreterDictee : demarrerDictee}
                                title={ecoute ? t('assistant.arreterDictee') : t('assistant.dicterMessage')}
                                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors disabled:opacity-50 ${ecoute ? 'bg-destructive/10 text-destructive animate-pulse' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                {ecoute ? <LuSquare size={14} /> : <LuMic size={16} />}
                            </button>
                        )}
                        <button
                            type='button'
                            onClick={envoyer}
                            disabled={!saisie.trim()}
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
