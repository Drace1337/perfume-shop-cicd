export type CheckoutCartRecord = {
	id: string
	items: { id: string; quantity: number }[]
}

export type CheckoutResponse = {
	status: 'completed'
	cartId: string
	clearedItems: number
	totalQuantity: number
}

export type CheckoutPrismaClient = {
	cart: {
		findUnique: (args: { where: { userId: string }; include: { items: true } }) => Promise<CheckoutCartRecord | null>
	}
	cartItem: {
		deleteMany: (args: { where: { cartId: string } }) => Promise<{ count: number }>
	}
}
