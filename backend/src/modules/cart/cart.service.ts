import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type {
	AddCartItemInput,
	CartItemRecord,
	CartItemResponse,
	CartPrismaClient,
	CartRecord,
	CartResponse,
} from './cart.types'

const cartInclude = {
	items: {
		include: { perfume: true },
		orderBy: { createdAt: 'asc' },
	},
} as const

const normalizePrice = (value: unknown): number => {
	const parsed = Number(value)
	if (Number.isNaN(parsed)) {
		throw new AppError('Invalid perfume price value', 500)
	}

	return parsed
}

const toCartItemResponse = (item: CartItemRecord): CartItemResponse => {
	const price = item.perfume ? normalizePrice(item.perfume.price) : 0

	return {
		id: item.id,
		perfumeId: item.perfumeId,
		quantity: item.quantity,
		lineTotal: Number((price * item.quantity).toFixed(2)),
		perfume: item.perfume
			? {
					id: item.perfume.id,
					name: item.perfume.name,
					brand: item.perfume.brand,
					price,
					imageUrl: item.perfume.imageUrl,
				}
			: null,
	}
}

const toCartResponse = (cart: CartRecord): CartResponse => {
	const items = (cart.items ?? []).map(toCartItemResponse)
	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
	const totalPrice = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2))

	return {
		id: cart.id,
		userId: cart.userId,
		items,
		totalItems,
		totalPrice,
	}
}

export class CartService {
	constructor(private readonly db: CartPrismaClient) {}

	public async getCart(userId: string): Promise<CartResponse> {
		this.assertUserId(userId)

		const existing = await this.db.cart.findUnique({
			where: { userId },
			include: cartInclude,
		})

		if (existing) {
			return toCartResponse(existing)
		}

		const created = await this.db.cart.create({
			data: { userId },
			include: cartInclude,
		})

		return toCartResponse(created)
	}

	public async addItem(userId: string, input: AddCartItemInput): Promise<CartResponse> {
		this.assertUserId(userId)

		if (!input.perfumeId) {
			throw new AppError('Perfume ID is required', 400)
		}

		if (!Number.isInteger(input.quantity) || input.quantity < 1) {
			throw new AppError('Quantity must be a positive integer', 400)
		}

		const perfume = await this.db.perfume.findUnique({ where: { id: input.perfumeId } })
		if (!perfume) {
			throw new AppError('Perfume not found', 404)
		}

		const cart = await this.db.cart.upsert({
			where: { userId },
			create: { userId },
			update: {},
		})

		await this.db.cartItem.upsert({
			where: {
				cartId_perfumeId: { cartId: cart.id, perfumeId: input.perfumeId },
			},
			create: {
				cartId: cart.id,
				perfumeId: input.perfumeId,
				quantity: input.quantity,
			},
			update: {
				quantity: { increment: input.quantity },
			},
		})

		return this.getCart(userId)
	}

	public async removeItem(userId: string, itemId: string): Promise<CartResponse> {
		this.assertUserId(userId)

		if (!itemId) {
			throw new AppError('Cart item ID is required', 400)
		}

		const cart = await this.db.cart.findUnique({ where: { userId } })
		if (!cart) {
			throw new AppError('Cart not found', 404)
		}

		const item = await this.db.cartItem.findUnique({ where: { id: itemId } })
		if (!item || item.cartId !== cart.id) {
			throw new AppError('Cart item not found', 404)
		}

		await this.db.cartItem.delete({ where: { id: itemId } })

		return this.getCart(userId)
	}

	private assertUserId(userId: string): void {
		if (!userId) {
			throw new AppError('Unauthorized', 401)
		}
	}
}

const prismaCartClient: CartPrismaClient = {
	cart: {
		findUnique: args => prisma.cart.findUnique(args) as Promise<CartRecord | null>,
		create: args => prisma.cart.create(args) as Promise<CartRecord>,
		upsert: args => prisma.cart.upsert(args) as Promise<CartRecord>,
	},
	cartItem: {
		findUnique: args => prisma.cartItem.findUnique(args) as Promise<CartItemRecord | null>,
		upsert: args => prisma.cartItem.upsert(args) as Promise<CartItemRecord>,
		delete: args => prisma.cartItem.delete(args) as Promise<CartItemRecord>,
	},
	perfume: {
		findUnique: args =>
			prisma.perfume.findUnique({
				where: args.where,
				select: { id: true },
			}),
	},
}

export const cartService = new CartService(prismaCartClient)
