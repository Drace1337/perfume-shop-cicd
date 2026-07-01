import { useEffect, useState } from 'react'

import { addCartItem } from '../api/cart.api'
import { getPerfumes } from '../api/perfumes.api'
import type { Perfume } from '../api/perfumes.api'
import { useAuth } from '../contexts/AuthContext'

const HomePage = () => {
	const { isAuthenticated } = useAuth()
	const [perfumes, setPerfumes] = useState<Perfume[]>([])
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [error, setError] = useState<string | null>(null)
	const [feedback, setFeedback] = useState<string | null>(null)

	useEffect(() => {
		const loadPerfumes = async () => {
			try {
				const data = await getPerfumes()
				setPerfumes(data)
			} catch {
				setError('Nie udało się pobrać listy perfum.')
			} finally {
				setIsLoading(false)
			}
		}

		void loadPerfumes()
	}, [])

	const handleAddToCart = async (perfumeId: string) => {
		setFeedback(null)
		try {
			await addCartItem(perfumeId, 1)
			setFeedback('Dodano do koszyka.')
		} catch {
			setFeedback('Nie udało się dodać do koszyka.')
		}
	}

	if (isLoading) {
		return <p className='text-slate-500'>Ładowanie katalogu...</p>
	}

	if (error) {
		return <p className='text-red-600'>{error}</p>
	}

	return (
		<section>
			<div className='mb-10 text-center'>
				<p className='mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-600'>Kolekcja</p>
				<h1 className='font-serif text-4xl font-semibold tracking-tight text-slate-900'>Katalog perfum</h1>
			</div>

			{feedback && (
				<p className='mx-auto mb-8 w-fit rounded-full bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-700'>
					{feedback}
				</p>
			)}

			{perfumes.length === 0 ? (
				<p className='text-center text-slate-500'>Brak perfum w katalogu.</p>
			) : (
				<div className='grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3'>
					{perfumes.map(perfume => (
						<article
							key={perfume.id}
							className='group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl'>
							<div className='aspect-square overflow-hidden bg-slate-100'>
								{perfume.imageUrl ? (
									<img
										src={perfume.imageUrl}
										alt={perfume.name}
										className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
									/>
								) : (
									<div className='flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 font-serif text-5xl text-slate-400'>
										{perfume.name.charAt(0)}
									</div>
								)}
							</div>

							<div className='flex flex-1 flex-col p-6'>
								<p className='text-xs font-semibold uppercase tracking-[0.2em] text-amber-600'>{perfume.brand}</p>
								<h2 className='mt-2 font-serif text-xl font-semibold text-slate-900'>{perfume.name}</h2>
								{perfume.description && (
									<p className='mt-3 flex-1 text-sm leading-relaxed text-slate-500'>{perfume.description}</p>
								)}

								<div className='mt-6 flex items-center justify-between'>
									<p className='text-2xl font-bold text-slate-900'>{perfume.price.toFixed(2)} zł</p>

									{isAuthenticated && (
										<button
											type='button'
											onClick={() => handleAddToCart(perfume.id)}
											className='rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-amber-600 hover:shadow-md'>
											Dodaj do koszyka
										</button>
									)}
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	)
}

export default HomePage
