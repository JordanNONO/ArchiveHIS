import React, { useEffect, useState } from 'react'
import { LuPlus, LuTrash2, LuAlertTriangle, LuCopy, LuCheck, LuKeyRound } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { getApiTokens, createApiToken, deleteApiToken } from '../../api/routes/apiToken'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

/**
 * Jetons d'API à portée large — pensés pour un agent externe (automatisation
 * de traitement de données), pas un compte humain. Chaque jeton donne un
 * accès complet aux données de l'application (voir ApiTokenController et
 * AuthPersonnelMiddleware côté backend : le jeton se résout vers un compte de
 * service qui porte le rôle Administrator). Le secret n'est affiché qu'une
 * seule fois, à la création — ensuite seul un préfixe reste visible pour
 * identifier le jeton, jamais de quoi le reconstituer.
 */
function JetonsApi() {
    const confirm = useConfirm()
    const [jetons, setJetons] = useState([])
    const [chargement, setChargement] = useState(true)
    const [nom, setNom] = useState('')
    const [creationEnCours, setCreationEnCours] = useState(false)
    const [nouveauJeton, setNouveauJeton] = useState(null)
    const [copie, setCopie] = useState(false)

    function fetchJetons() {
        setChargement(true)
        getApiTokens().then(async (res) => {
            if (res.status === 200) setJetons(await res.json())
        }).catch(() => {}).finally(() => setChargement(false))
    }

    useEffect(() => {
        fetchJetons()
    }, [])

    async function submitCreation(e) {
        e.preventDefault()
        try {
            setCreationEnCours(true)
            const res = await createApiToken({ nom })
            if (res.status === 201) {
                const data = await res.json()
                document.getElementById('creer_jeton').close()
                setNom('')
                setNouveauJeton(data)
                setCopie(false)
                document.getElementById('afficher_jeton').showModal()
                fetchJetons()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || 'Une erreur est survenue')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setCreationEnCours(false)
        }
    }

    async function copierJeton() {
        try {
            await navigator.clipboard.writeText(nouveauJeton.jeton)
            setCopie(true)
        } catch {
            toast.error('La copie automatique a échoué — sélectionnez le texte manuellement')
        }
    }

    async function revoquer(jeton) {
        if (!await confirm({
            message: `Révoquer le jeton « ${jeton.nom} » ? Toute intégration qui l'utilise perdra l'accès immédiatement — ceci est irréversible.`,
            danger: true,
            confirmLabel: 'Révoquer',
        })) return
        deleteApiToken(jeton.id).then((res) => {
            if (res.status === 200) {
                toast.success('Jeton révoqué')
                fetchJetons()
            } else {
                toast.error('Une erreur est survenue')
            }
        }).catch(() => toast.error('Une erreur est survenue'))
    }

    return (
        <div>
            <div className='rounded-2xl border border-accent/40 bg-accent/5 p-4 mb-4 flex items-start gap-3'>
                <LuAlertTriangle size={18} className='text-accent-foreground shrink-0 mt-0.5' />
                <p className='text-sm text-foreground'>
                    Un jeton d'API donne un <strong>accès complet à toutes les données de l'application</strong> — au même niveau qu'un administrateur, sans passer par une connexion normale. Ne le partagez qu'avec une intégration de confiance (ex : un agent de traitement de données), et révoquez-le immédiatement si vous avez un doute.
                </p>
            </div>

            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={() => document.getElementById('creer_jeton').showModal()}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'
                >
                    <LuPlus size={16} />
                    Générer un nouveau jeton
                </button>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th>Nom</th>
                                <th>Jeton</th>
                                <th>Créé par</th>
                                <th>Dernière utilisation</th>
                                <th>Statut</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jetons.map((j) => (
                                <tr key={j.id}>
                                    <td className='font-medium'>{j.nom}</td>
                                    <td className='font-mono text-xs text-muted-foreground'>{j.prefixe}</td>
                                    <td className='text-muted-foreground'>{j.cree_par || '—'}</td>
                                    <td className='text-muted-foreground'>{j.dernier_utilise_le ? new Date(j.dernier_utilise_le).toLocaleString() : 'Jamais utilisé'}</td>
                                    <td>
                                        {j.revoque_le ? (
                                            <span className='inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium'>Révoqué</span>
                                        ) : (
                                            <span className='inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 px-2 py-0.5 text-xs font-medium'>Actif</span>
                                        )}
                                    </td>
                                    <td>
                                        {!j.revoque_le && (
                                            <button
                                                onClick={() => revoquer(j)}
                                                title='Révoquer'
                                                className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors'
                                            >
                                                <LuTrash2 size={15} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!chargement && jetons.length === 0 && (
                                <tr>
                                    <td colSpan="6" className='text-center py-8 text-muted-foreground'>Aucun jeton généré</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="creer_jeton" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-lg font-semibold mb-1'>Générer un nouveau jeton</h1>
                        <p className='text-sm text-muted-foreground mb-4'>Donnez-lui un nom qui rappelle son usage (ex : « Agent de traitement — production »).</p>
                        <form onSubmit={submitCreation}>
                            <div className="mb-4">
                                <label htmlFor="nom_jeton" className='block text-sm font-medium mb-1.5'>Nom du jeton <span className='text-red-500'>*</span></label>
                                <input
                                    type="text"
                                    id='nom_jeton'
                                    value={nom}
                                    onChange={(e) => setNom(e.target.value)}
                                    placeholder="Agent de traitement de données"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div className='modal-action'>
                                <button type='submit' disabled={creationEnCours} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                    {creationEnCours ? 'Génération...' : 'Générer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="afficher_jeton" className="modal">
                <div className="modal-box rounded-2xl">
                    <div className='flex flex-col items-center text-center gap-2 mb-4'>
                        <span className='flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary'>
                            <LuKeyRound size={22} />
                        </span>
                        <h1 className='text-lg font-semibold'>Jeton généré</h1>
                        <p className='text-sm text-muted-foreground'>
                            Copiez-le maintenant — il ne sera <strong>plus jamais affiché</strong> ensuite.
                        </p>
                    </div>
                    {nouveauJeton && (
                        <div className='flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 mb-4'>
                            <code className='flex-1 min-w-0 text-xs font-mono break-all'>{nouveauJeton.jeton}</code>
                            <button
                                onClick={copierJeton}
                                title='Copier'
                                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${copie ? 'bg-green-500/10 text-green-600' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                {copie ? <LuCheck size={16} /> : <LuCopy size={16} />}
                            </button>
                        </div>
                    )}
                    <div className='rounded-xl border border-accent/40 bg-accent/5 p-3 mb-4 flex items-start gap-2.5'>
                        <LuAlertTriangle size={16} className='text-accent-foreground shrink-0 mt-0.5' />
                        <p className='text-xs text-foreground'>
                            À transmettre à l'agent via l'en-tête <code className='font-mono bg-muted px-1 py-0.5 rounded'>X-Api-Key</code>. Ce jeton donne un accès complet aux données — gardez-le secret.
                        </p>
                    </div>
                    <div className='modal-action'>
                        <button
                            onClick={() => { document.getElementById('afficher_jeton').close(); setNouveauJeton(null) }}
                            className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
                        >
                            J'ai copié le jeton
                        </button>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

export default JetonsApi
