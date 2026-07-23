import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLock } from "react-icons/fi"
import { IoMailOutline } from "react-icons/io5"
import { toast } from 'react-toastify'
import Loading from '../components/Loading'
import { loginAPI } from '../api/routes/auth'
function Login() {
	const [user, setUser] = useState({ email: "", password: "" })
	const [loading, setLoading] = useState(false)
	function onChangeData(e) {
		setUser((prevData) => ((
			{
				...prevData,
				[e.target.id]: e.target.value
			}
		)))
	}
	function handSubmit(e) {
		e.preventDefault()
		if (Object.keys(user).filter((u) => user[u] === "").length === 0) {
			setLoading(true)
			const { email, password } = user
            loginAPI({login:email,password}).then(async function(response){
                if(response.status ===200){
                    setLoading(false)
                    const {token} = await response.json()
                    sessionStorage.setItem("token",token)
                    toast.success("Bienvenue")
                    window.location.href = "/"
                    return;
                }else{
                    setLoading(false)
                    toast.error("Information de connexion incorrect")
                    return;
                }
            }).catch((err)=>{
                console.log(err)
            })
			
		} else {
			toast.warning("Veuillez remplir tous les champs...")
		}
	}
	return loading ? <Loading /> : (
		<div className='flex items-center justify-center'>
			<div className='xl:w-1/3 md:w-1/2 w-full p-3'>
				<h1 className='text-3xl text-center uppercase'>Se connecter</h1>
				<form
					method='post'
					className='p-8'>
					<div className='relative mb-8'>
						<IoMailOutline className='absolute text-gray-500 left-0 bottom-3 text-xl' />
						<input
							type='text'
							placeholder='Email'
							onChange={onChangeData}
							id='email'
							className='border-b-2 indent-7 w-full p-2 outline-none'
						/>
					</div>
					<div className='relative mb-10'>
						<FiLock className='absolute text-gray-500 left-0 bottom-3 text-xl' />
						<input
							type='password'
							onChange={onChangeData}
							id='password'
							placeholder='Mot de passe'
							className='border-b-2 indent-7 w-full p-2 outline-none'
						/>
						<div>
							<div className='absolute right-0 -bottom-6 text-slate-800'>
								<Link to={"#"}>Mot de passe oublié</Link>
							</div>
						</div>
					</div>

					<button onClick={handSubmit} className='bg-primary w-full text-white rounded p-3'>
						Connexion
					</button>
				</form>

				
				<div className='text-center mt-3'>
					<p className='text-center'>
						Veuillez-vous connecter à la platforme d'archivage
					</p>
				</div>
			</div>
		</div>
	)
}

export default Login