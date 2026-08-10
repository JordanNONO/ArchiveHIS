import React from 'react'
import { Link } from 'react-router-dom'
import { LuArrowLeft, LuPhoneCall, LuMapPin, LuPhone, LuMail, LuClock3, LuSiren } from 'react-icons/lu'

/**
 * Coordonnées de l'entreprise + numéros d'urgence utiles au métier (aide à
 * domicile) — accessible aux comptes intervenant ET bénéficiaire (voir
 * Sidebar.jsx), pas seulement en interne. Contenu statique : ces
 * informations ne changent pas au gré des dépôts de documents, inutile
 * d'en faire un modèle de données à part.
 */
const COORDONNEES = [
  { icon: LuMapPin, label: 'Adresse', valeur: '187 Boulevard Anatole France, 93200 Saint-Denis' },
  { icon: LuPhone, label: 'Téléphone', valeur: '01 43 52 64 23', href: 'tel:0143526423' },
  { icon: LuMail, label: 'Email', valeur: 'his@donnerlavieauxannees.com', href: 'mailto:his@donnerlavieauxannees.com' },
  { icon: LuClock3, label: 'Horaires', valeur: 'Lun - Ven : 9h00 - 18h00 · Sam : 10h00 - 16h00' },
]

const CONTACTS_URGENCE = [
  { label: 'SAMU', numero: '15', description: 'Urgence médicale' },
  { label: 'Police secours', numero: '17', description: "Sécurité, danger immédiat" },
  { label: 'Pompiers', numero: '18', description: 'Incendie, secours' },
  { label: "Numéro d'urgence européen", numero: '112', description: 'Depuis un mobile, partout en Europe' },
]

function Contact() {
  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3'>
          <LuArrowLeft size={13} /> Tableau de bord
        </Link>
        <div className='flex items-center gap-3'>
          <span className='w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0'>
            <LuPhoneCall size={21} />
          </span>
          <div>
            <h1 className='text-xl font-bold text-foreground'>Contact</h1>
            <p className='text-sm text-muted-foreground'>Nos coordonnées et les numéros utiles</p>
          </div>
        </div>
      </div>

      <div className='rounded-3xl border border-border bg-card shadow-sm overflow-hidden'>
        <div className='px-4 py-3.5 border-b border-border'>
          <p className='text-sm font-semibold text-foreground'>Hetep Iaout Services</p>
          <p className='text-xs text-muted-foreground'>Aide à domicile</p>
        </div>
        {COORDONNEES.map((c) => {
          const Contenu = (
            <>
              <span className='flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-primary/10 text-primary'>
                <c.icon size={17} />
              </span>
              <div className='flex-1 min-w-0'>
                <p className='text-xs text-muted-foreground'>{c.label}</p>
                <p className='text-sm font-medium text-foreground'>{c.valeur}</p>
              </div>
            </>
          )
          return c.href ? (
            <a key={c.label} href={c.href} className='flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors'>
              {Contenu}
            </a>
          ) : (
            <div key={c.label} className='flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0'>
              {Contenu}
            </div>
          )
        })}
      </div>

      <div className='rounded-3xl border border-border bg-card shadow-sm overflow-hidden'>
        <div className='px-4 py-3.5 border-b border-border flex items-center gap-2'>
          <LuSiren size={15} className='text-destructive' />
          <p className='text-sm font-semibold text-foreground'>Contacts d'urgence</p>
        </div>
        {CONTACTS_URGENCE.map((c) => (
          <a
            key={c.numero}
            href={`tel:${c.numero}`}
            className='flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-destructive/5 transition-colors'
          >
            <span className='flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-destructive/10 text-destructive font-bold text-sm'>
              {c.numero}
            </span>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium text-foreground'>{c.label}</p>
              <p className='text-xs text-muted-foreground'>{c.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export default Contact
