import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

const Navbar = () => {
	const { isAuthenticated, user, logout } = useAuth()
	const navigate = useNavigate()

	const handleLogout = () => {
		logout()
		navigate('/login')
	}

	return (
		<header className='sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-md'>
			<nav className='mx-auto flex max-w-6xl items-center justify-between px-6 py-4'>
				<Link to='/' className='font-serif text-2xl font-semibold tracking-wide text-slate-900'>
					Perfume<span className='text-amber-600'>Shop</span>
				</Link>

				<div className='flex items-center gap-6 text-sm font-medium'>
					<Link to='/' className='text-slate-600 transition-colors hover:text-slate-900'>
						Katalog
					</Link>

					{isAuthenticated ? (
						<>
							<Link to='/cart' className='text-slate-600 transition-colors hover:text-slate-900'>
								Koszyk
							</Link>
							<span className='hidden text-slate-400 sm:inline'>{user?.email}</span>
							<button
								type='button'
								onClick={handleLogout}
								className='rounded-full bg-slate-900 px-5 py-2 text-white shadow-sm transition-all hover:bg-slate-700 hover:shadow-md'>
								Wyloguj
							</button>
						</>
					) : (
						<>
							<Link to='/login' className='text-slate-600 transition-colors hover:text-slate-900'>
								Logowanie
							</Link>
							<Link
								to='/register'
								className='rounded-full bg-amber-600 px-5 py-2 text-white shadow-sm transition-all hover:bg-amber-700 hover:shadow-md'>
								Rejestracja
							</Link>
						</>
					)}
				</div>
			</nav>
		</header>
	)
}

export default Navbar
