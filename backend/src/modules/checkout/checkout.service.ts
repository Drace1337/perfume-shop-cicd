import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { CheckoutCartRecord, CheckoutPrismaClient, CheckoutResponse } from './checkout.types'

export class CheckoutService {
	constructor(private readonly db: CheckoutPrismaClient) {}

	public async checkout(userId: string): Promise<CheckoutResponse> {
		if (!userId) {
			throw new AppError('Unauthorized', 401)
		}

		const cart = await this.db.cart.findUnique({
			where: { userId },
			include: { items: true },
		})

		if (!cart) {
			throw new AppError('Cart not found', 404)
		}

		if (cart.items.length === 0) {
			throw new AppError('Cart is empty', 400)
		}

		const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0)

		const result = await this.db.cartItem.deleteMany({ where: { cartId: cart.id } })

		return {
			status: 'completed',
			cartId: cart.id,
			clearedItems: result.count,
			totalQuantity,
		}
	}
}

const prismaCheckoutClient: CheckoutPrismaClient = {
	cart: {
		findUnique: args => prisma.cart.findUnique(args) as Promise<CheckoutCartRecord | null>,
	},
	cartItem: {
		deleteMany: args => prisma.cartItem.deleteMany(args),
	},
}

export const checkoutService = new CheckoutService(prismaCheckoutClient)
