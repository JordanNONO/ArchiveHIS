import React, { useState, useEffect, useRef } from 'react';
import { LuCamera } from 'react-icons/lu';
import { toast } from 'react-toastify';
import AuthInfo from './_Partials/AuthInfo';
import PersonnalInfo from './_Partials/PersonnalInfo';
import Breadcrumbs from '../components/Breadcrumbs';
import { updateProfile } from '../api/routes/personnel';
import { SERVER_URL } from '../api';
import { getDisplayName, getInitials } from '../utils/common';

const TABS = [
  { key: 'infos', label: 'Informations personnelles' },
  { key: 'securite', label: 'Sécurité' },
]

const Profile = () => {
  const [user, setUser] = useState({})
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('infos')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const getUser = JSON.parse(sessionStorage.getItem("user"))
    setUser(getUser)
    setPhoto(getUser?.profile ? SERVER_URL + getUser.profile : null)
  }, []);

  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setPhoto(previewUrl)
    setUploading(true)

    updateProfile(file).then(async (res) => {
      setUploading(false)
      if (res.status === 200) {
        const data = await res.json()
        const updatedUser = { ...user, profile: data.profile }
        sessionStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        toast.success("Photo de profil mise à jour")
      } else {
        toast.error("Une erreur s'est produite lors de l'envoi de la photo")
      }
    }).catch(() => {
      setUploading(false)
      toast.error("Une erreur s'est produite lors de l'envoi de la photo")
    })
  }

  function onPersonnelUpdated(personnel) {
    const updatedUser = { ...user, personnel }
    sessionStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  const displayName = getDisplayName(user)
  const initials = getInitials(displayName)

  return (
    <div className='w-full py-6'>
      <Breadcrumbs where="Profil" />
      <h2 className='text-2xl font-semibold text-foreground mt-1 mb-6'>Mon profil</h2>

      <div className='rounded-2xl border border-border bg-card p-6 mb-6'>
        <div className='flex items-center gap-5'>
          <div
            className='relative w-24 h-24 rounded-full shrink-0 cursor-pointer group'
            onClick={() => fileInputRef.current?.click()}
          >
            {photo ? (
              <img src={photo} alt="" className="w-full h-full rounded-full object-cover ring-4 ring-primary/10" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white text-2xl font-semibold ring-4 ring-primary/10">
                {initials || '?'}
              </div>
            )}
            <div className='absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
              <LuCamera size={22} className='text-white' />
            </div>
            {uploading && (
              <div className='absolute inset-0 rounded-full bg-black/60 flex items-center justify-center'>
                <span className='text-white text-xs'>Envoi...</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              onChange={onFileChange}
              type="file"
              accept='image/png,image/jpeg,image/jpg'
              className='hidden'
            />
          </div>
          <div className='min-w-0 flex-1'>
            <h1 className='text-xl font-semibold text-foreground truncate'>
              {displayName}
            </h1>
            <p className='text-sm text-muted-foreground mt-0.5 truncate'>{user?.mail}</p>
            {user?.role && (
              <span className='inline-flex mt-2 rounded-md bg-secondary/10 text-secondary px-2 py-1 text-xs font-medium'>{user.role}</span>
            )}
          </div>
        </div>
      </div>

      <div className='inline-flex items-center gap-1 rounded-lg bg-muted p-1 mb-5'>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className='rounded-2xl border border-border bg-card p-6'>
        {activeTab === 'infos' && <PersonnalInfo user={user} onUpdated={onPersonnelUpdated} />}
        {activeTab === 'securite' && <AuthInfo user={user} />}
      </div>
    </div>
  );
};

export default Profile;
