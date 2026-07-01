import { useCallback, useEffect, useState } from 'react'

import { checkout, getCart, removeCartItem } from '../api/cart.api'
import type { Cart } from '../api/cart.api'

const CartPage = () => {
	const [cart, setCart] = useState<Cart | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)

	const loadCart = useCallback(async () => {
		try {
			const data = await getCart()
			setCart(data)
		} catch {
			setError('Nie udało się pobrać koszyka.')
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void loadCart()
	}, [loadCart])

	const handleRemove = async (itemId: string) => {
		setMessage(null)
		try {
			const updated = await removeCartItem(itemId)
			setCart(updated)
		} catch {
			setError('Nie udało się usunąć elementu z koszyka.')
		}
	}

	const handleCheckout = async () => {
		setMessage(null)
		try {
			const result = await checkout()
			setMessage(`Zamówienie opłacone. Wyczyszczono pozycji: ${result.clearedItems}.`)
			await loadCart()
		} catch {
			setError('Płatność nie powiodła się.')
		}
	}

	if (isLoading) {
		return <p className='text-slate-500'>Ładowanie koszyka...</p>
	}

	if (error) {
		return <p className='text-red-600'>{error}</p>
	}

	const isEmpty = !cart || cart.items.length === 0

	return (
		<section className='mx-auto max-w-3xl'>
			<h1 className='mb-8 font-serif text-3xl font-semibold tracking-tight text-slate-900'>Twój koszyk</h1>

			{message && <p className='mb-6 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700'>{message}</p>}

			{isEmpty ? (
				<p className='rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500'>
					Koszyk jest pusty.
				</p>
			) : (
				<div className='space-y-6'>
					<ul className='divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm'>
						{cart.items.map(item => (
							<li key={item.id} className='flex items-center justify-between px-6 py-5'>
								<div>
									<p className='font-serif text-lg font-semibold text-slate-900'>{item.perfume?.name ?? 'Perfumy'}</p>
									<p className='mt-1 text-sm text-slate-500'>
										{item.quantity} szt. × {item.perfume?.price.toFixed(2) ?? '0.00'} zł
									</p>
								</div>
								<div className='flex items-center gap-6'>
									<span className='font-semibold text-slate-900'>{item.lineTotal.toFixed(2)} zł</span>
									<button
										type='button'
										onClick={() => handleRemove(item.id)}
										className='rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600'>
										Usuń
									</button>
								</div>
							</li>
						))}
					</ul>

					<div className='flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm'>
						<span className='text-lg font-medium text-slate-600'>Razem</span>
						<span className='font-serif text-2xl font-bold text-slate-900'>{cart.totalPrice.toFixed(2)} zł</span>
					</div>

					<button
						type='button'
						onClick={handleCheckout}
						className='w-full rounded-full bg-amber-600 px-6 py-3.5 font-medium text-white shadow-sm transition-all hover:bg-amber-700 hover:shadow-md'>
						Opłać zamówienie
					</button>
				</div>
			)}
		</section>
	)
}

export default CartPage
