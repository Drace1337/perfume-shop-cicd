import { apiClient } from '../lib/api-client'

export type CartItem = {
	id: string
	perfumeId: string
	quantity: number
	lineTotal: number
	perfume: {
		id: string
		name: string
		brand: string
		price: number
		imageUrl: string | null
	} | null
}

export type Cart = {
	id: string
	userId: string
	items: CartItem[]
	totalItems: number
	totalPrice: number
}

export type CheckoutResult = {
	status: 'completed'
	cartId: string
	clearedItems: number
	totalQuantity: number
}

export const getCart = (): Promise<Cart> => apiClient.get<Cart>('/cart')

export const addCartItem = (perfumeId: string, quantity = 1): Promise<Cart> =>
	apiClient.post<Cart>('/cart/items', { perfumeId, quantity })

export const removeCartItem = (itemId: string): Promise<Cart> => apiClient.delete<Cart>(`/cart/items/${itemId}`)

export const checkout = (): Promise<CheckoutResult> => apiClient.post<CheckoutResult>('/checkout')
