import { CartService } from './cart.service'
import type { CartPrismaClient, CartRecord } from './cart.types'

describe('CartService', () => {
	const cartFindUnique = jest.fn()
	const cartCreate = jest.fn()
	const cartUpsert = jest.fn()
	const cartItemFindUnique = jest.fn()
	const cartItemUpsert = jest.fn()
	const cartItemDelete = jest.fn()
	const perfumeFindUnique = jest.fn()

	const mockPrisma: CartPrismaClient = {
		cart: {
			findUnique: cartFindUnique,
			create: cartCreate,
			upsert: cartUpsert,
		},
		cartItem: {
			findUnique: cartItemFindUnique,
			upsert: cartItemUpsert,
			delete: cartItemDelete,
		},
		perfume: {
			findUnique: perfumeFindUnique,
		},
	}

	const service = new CartService(mockPrisma)

	const sampleCart: CartRecord = {
		id: 'cart-1',
		userId: 'user-1',
		createdAt: new Date(),
		updatedAt: new Date(),
		items: [
			{
				id: 'item-1',
				cartId: 'cart-1',
				perfumeId: 'perfume-1',
				quantity: 2,
				createdAt: new Date(),
				updatedAt: new Date(),
				perfume: {
					id: 'perfume-1',
					name: 'Aqua Breeze',
					brand: 'Oceanic',
					price: '150.00',
					imageUrl: null,
				},
			},
		],
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('returns existing cart with computed totals', async () => {
		cartFindUnique.mockResolvedValue(sampleCart)

		const result = await service.getCart('user-1')

		expect(cartCreate).not.toHaveBeenCalled()
		expect(result.totalItems).toBe(2)
		expect(result.totalPrice).toBe(300)
		expect(result.items[0].lineTotal).toBe(300)
		expect(result.items[0].perfume?.price).toBe(150)
	})

	it('creates a new empty cart when none exists', async () => {
		cartFindUnique.mockResolvedValue(null)
		cartCreate.mockResolvedValue({
			id: 'cart-2',
			userId: 'user-2',
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		} satisfies CartRecord)

		const result = await service.getCart('user-2')

		expect(cartCreate).toHaveBeenCalledTimes(1)
		expect(result.items).toHaveLength(0)
		expect(result.totalPrice).toBe(0)
	})

	it('adds an item to the cart for an existing perfume', async () => {
		perfumeFindUnique.mockResolvedValue({ id: 'perfume-1' })
		cartUpsert.mockResolvedValue(sampleCart)
		cartItemUpsert.mockResolvedValue(sampleCart.items?.[0])
		cartFindUnique.mockResolvedValue(sampleCart)

		const result = await service.addItem('user-1', { perfumeId: 'perfume-1', quantity: 1 })

		expect(perfumeFindUnique).toHaveBeenCalledWith({ where: { id: 'perfume-1' } })
		expect(cartItemUpsert).toHaveBeenCalledTimes(1)
		expect(result.totalItems).toBe(2)
	})

	it('throws 404 when adding a non-existing perfume', async () => {
		perfumeFindUnique.mockResolvedValue(null)

		await expect(service.addItem('user-1', { perfumeId: 'missing', quantity: 1 })).rejects.toMatchObject({
			statusCode: 404,
		})
		expect(cartItemUpsert).not.toHaveBeenCalled()
	})

	it('throws 400 for invalid quantity', async () => {
		await expect(service.addItem('user-1', { perfumeId: 'perfume-1', quantity: 0 })).rejects.toMatchObject({
			statusCode: 400,
		})
	})

	it('removes an item that belongs to the user cart', async () => {
		cartFindUnique.mockResolvedValueOnce({ id: 'cart-1', userId: 'user-1' })
		cartItemFindUnique.mockResolvedValue({ id: 'item-1', cartId: 'cart-1' })
		cartItemDelete.mockResolvedValue({ id: 'item-1' })
		cartFindUnique.mockResolvedValueOnce(sampleCart)

		const result = await service.removeItem('user-1', 'item-1')

		expect(cartItemDelete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
		expect(result.id).toBe('cart-1')
	})

	it('throws 404 when removing an item from another cart', async () => {
		cartFindUnique.mockResolvedValue({ id: 'cart-1', userId: 'user-1' })
		cartItemFindUnique.mockResolvedValue({ id: 'item-9', cartId: 'other-cart' })

		await expect(service.removeItem('user-1', 'item-9')).rejects.toMatchObject({
			statusCode: 404,
		})
		expect(cartItemDelete).not.toHaveBeenCalled()
	})
})
