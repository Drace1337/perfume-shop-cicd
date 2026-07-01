import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

const RegisterPage = () => {
	const { register } = useAuth()
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		setIsSubmitting(true)

		try {
			await register({
				email,
				password,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
			})
			navigate('/')
		} catch {
			setError('Rejestracja nie powiodła się. Sprawdź dane i spróbuj ponownie.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<section className='mx-auto max-w-sm'>
			<h1 className='mb-6 text-2xl font-bold'>Rejestracja</h1>

			<form onSubmit={handleSubmit} className='space-y-4'>
				<div>
					<label htmlFor='firstName' className='mb-1 block text-sm font-medium'>
						Imię
					</label>
					<input
						id='firstName'
						type='text'
						value={firstName}
						onChange={event => setFirstName(event.target.value)}
						className='w-full rounded border border-gray-300 px-3 py-2'
					/>
				</div>

				<div>
					<label htmlFor='lastName' className='mb-1 block text-sm font-medium'>
						Nazwisko
					</label>
					<input
						id='lastName'
						type='text'
						value={lastName}
						onChange={event => setLastName(event.target.value)}
						className='w-full rounded border border-gray-300 px-3 py-2'
					/>
				</div>

				<div>
					<label htmlFor='email' className='mb-1 block text-sm font-medium'>
						E-mail
					</label>
					<input
						id='email'
						type='email'
						value={email}
						onChange={event => setEmail(event.target.value)}
						required
						className='w-full rounded border border-gray-300 px-3 py-2'
					/>
				</div>

				<div>
					<label htmlFor='password' className='mb-1 block text-sm font-medium'>
						Hasło (min. 8 znaków)
					</label>
					<input
						id='password'
						type='password'
						value={password}
						onChange={event => setPassword(event.target.value)}
						required
						minLength={8}
						className='w-full rounded border border-gray-300 px-3 py-2'
					/>
				</div>

				{error && <p className='text-sm text-red-600'>{error}</p>}

				<button
					type='submit'
					disabled={isSubmitting}
					className='w-full rounded bg-gray-900 px-3 py-2 text-white hover:bg-gray-700 disabled:opacity-60'>
					{isSubmitting ? 'Rejestracja...' : 'Zarejestruj się'}
				</button>
			</form>

			<p className='mt-4 text-sm text-gray-600'>
				Masz już konto?{' '}
				<Link to='/login' className='font-medium text-gray-900 underline'>
					Zaloguj się
				</Link>
			</p>
		</section>
	)
}

export default RegisterPage
