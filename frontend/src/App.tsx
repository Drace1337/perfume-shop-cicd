import { Navigate, Route, Routes } from 'react-router-dom'

import Navbar from './components/Navbar'
import { useAuth } from './contexts/AuthContext'
import CartPage from './pages/CartPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

const App = () => {
	const { isAuthenticated } = useAuth()

	return (
		<div className='min-h-screen bg-slate-50 text-slate-900'>
			<Navbar />
			<main className='mx-auto max-w-6xl px-6 py-12'>
				<Routes>
					<Route path='/' element={<HomePage />} />
					<Route path='/login' element={<LoginPage />} />
					<Route path='/register' element={<RegisterPage />} />
					<Route path='/cart' element={isAuthenticated ? <CartPage /> : <Navigate to='/login' replace />} />
					<Route path='*' element={<Navigate to='/' replace />} />
				</Routes>
			</main>
		</div>
	)
}

export default App
