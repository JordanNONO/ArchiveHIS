import React, { useState } from 'react';
import { updateLoginAPI } from '../../api/routes/auth';
import { toast } from 'react-toastify';
import { getFormData } from '../../utils/common';

function AuthInfo({ user }) {
    const [authData, setAuthData] = useState({
        email: user?.email || '',
        password: ''
    });

    function updateAuth(e) {
        e.preventDefault();
        updateLoginAPI(authData)
            .then((res) => {
                if (res.status === 200) {
                    toast.success("Information de connexion bien mise à jour");
                    setAuthData({ ...authData, password: '' }); // Clear password field after successful update
                } else {
                    toast.error("Une erreur s'est produite");
                }
            })
            .catch((err) => {
                toast.error("Une erreur s'est produite");
            });
    }

    return (
        <div>
            <form onSubmit={updateAuth} method="post">
                <label className="input input-bordered flex items-center gap-2 mb-3">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                        <path
                            d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                    </svg>
                    <input
                        type="text"
                        className="grow"
                        name='email'
                        onChange={(e) => getFormData(e, setAuthData)}
                        placeholder="Email"
                        value={authData.email}
                    />
                </label>
                <label className="input input-bordered flex items-center gap-2 mb-3">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            fillRule="evenodd"
                            d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
                            clipRule="evenodd" />
                    </svg>
                    <input
                        type="password"
                        onChange={(e) => getFormData(e, setAuthData)}
                        name='password'
                        className="grow"
                        value={authData.password}
                        placeholder='***************'
                    />
                </label>
                <button type="submit" className='p-2 bg-primary text-white hover:bg-primary rounded btn'>Mettre à jour</button>
            </form>
        </div>
    );
}

export default AuthInfo;
