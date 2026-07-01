import { CheckoutService } from './checkout.service'
import type { CheckoutPrismaClient } from './checkout.types'

describe('CheckoutService', () => {
	const cartFindUnique = jest.fn()
	const cartItemDeleteMany = jest.fn()

	const mockPrisma: CheckoutPrismaClient = {
		cart: {
			findUnique: cartFindUnique,
		},
		cartItem: {
			deleteMany: cartItemDeleteMany,
		},
	}

	const service = new CheckoutService(mockPrisma)

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('clears cart items and returns a completed summary', async () => {
		cartFindUnique.mockResolvedValue({
			id: 'cart-1',
			items: [
				{ id: 'item-1', quantity: 2 },
				{ id: 'item-2', quantity: 1 },
			],
		})
		cartItemDeleteMany.mockResolvedValue({ count: 2 })

		const result = await service.checkout('user-1')

		expect(cartItemDeleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart-1' } })
		expect(result).toEqual({
			status: 'completed',
			cartId: 'cart-1',
			clearedItems: 2,
			totalQuantity: 3,
		})
	})

	it('throws 404 when the cart does not exist', async () => {
		cartFindUnique.mockResolvedValue(null)

		await expect(service.checkout('user-1')).rejects.toMatchObject({ statusCode: 404 })
		expect(cartItemDeleteMany).not.toHaveBeenCalled()
	})

	it('throws 400 when the cart is empty', async () => {
		cartFindUnique.mockResolvedValue({ id: 'cart-1', items: [] })

		await expect(service.checkout('user-1')).rejects.toMatchObject({ statusCode: 400 })
		expect(cartItemDeleteMany).not.toHaveBeenCalled()
	})
})
