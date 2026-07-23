import React, { useState, useEffect } from 'react';
import AuthInfo from './_Partials/AuthInfo';
import PersonnalInfo from './_Partials/PersonnalInfo';
import { updateProfile } from '../api/routes/personnel';
import { SERVER_URL } from '../api';

const Profile = () => {
  const [user, setUser] = useState({})
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    const getUser = JSON.parse(sessionStorage.getItem("user"))
    setUser(getUser)
    setPhoto(SERVER_URL + getUser?.profile)
  }, []);
  /**
   * 
   * @param {Event} e 
   */
  function onFileChange(e) {
    if (e.target.files?.length > 0) {
      updateProfile(e.target.files[0])
      const url = URL.createObjectURL(e.target.files[0])
      setPhoto(url)
    }
  }
  return (
    <div className='w-full py-5'>
      <div className='flex items-start gap-3'>
        <div className="avatar">
          <div className="w-24 rounded-full relative">
            <img src={photo ?? "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} />
            <input onChange={onFileChange} type="file" accept='image/*' className=' opacity-0 absolute top-0 w-full h-full rounded-full appearance-none file:appearance-none' />
          </div>
        </div>
        <div>
          <h1 className='text-3xl font-bold mb-3'>
            {user.name}
          </h1>
          <p className="mx-2 badge badge-neutral"> {user.role}</p>
        </div>

      </div>
      <div className='flex flex-grow'>
        <div className="mt-5 w-full">
          <div role="tablist" className="tabs tabs-lifted w-full">
            {/* <input type="radio"  name="my_tabs_2" role="tab" className="tab" aria-label="Système" />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        
                    </div> */}
            <input

              type="radio"
              name="my_tabs_2"
              role="tab"
              className="tab"
              defaultChecked
              aria-label="Informations personnelles"
            />
            <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
              <PersonnalInfo user={user} />
            </div>

            <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="Information de connexion" />
            <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
              <AuthInfo user={user} />
            </div>
            {/* <input

                        type="radio"
                        name="my_tabs_2"
                        role="tab"
                        className="tab"
                        aria-label="Stockage"
                    />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        Stockage
                    </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
