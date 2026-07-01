import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

const LoginPage = () => {
	const { login } = useAuth()
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		setIsSubmitting(true)

		try {
			await login({ email, password })
			navigate('/')
		} catch {
			setError('Nieprawidłowy e-mail lub hasło.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<section className='mx-auto max-w-md'>
			<div className='rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg'>
				<div className='mb-8 text-center'>
					<p className='mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-600'>Witaj ponownie</p>
					<h1 className='font-serif text-3xl font-semibold tracking-tight text-slate-900'>Logowanie</h1>
				</div>

				<form onSubmit={handleSubmit} className='space-y-5'>
					<div>
						<label htmlFor='email' className='mb-1.5 block text-sm font-medium text-slate-700'>
							E-mail
						</label>
						<input
							id='email'
							type='email'
							value={email}
							onChange={event => setEmail(event.target.value)}
							required
							className='w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100'
						/>
					</div>

					<div>
						<label htmlFor='password' className='mb-1.5 block text-sm font-medium text-slate-700'>
							Hasło
						</label>
						<input
							id='password'
							type='password'
							value={password}
							onChange={event => setPassword(event.target.value)}
							required
							className='w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100'
						/>
					</div>

					{error && <p className='text-sm text-red-600'>{error}</p>}

					<button
						type='submit'
						disabled={isSubmitting}
						className='w-full rounded-full bg-slate-900 px-6 py-3 font-medium text-white shadow-sm transition-all hover:bg-amber-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60'>
						{isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
					</button>
				</form>

				<p className='mt-6 text-center text-sm text-slate-500'>
					Nie masz konta?{' '}
					<Link to='/register' className='font-medium text-amber-600 underline-offset-2 hover:underline'>
						Zarejestruj się
					</Link>
				</p>
			</div>
		</section>
	)
}

export default LoginPage
