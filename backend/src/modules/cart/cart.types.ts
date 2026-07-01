export type CartItemPerfumeRecord = {
	id: string
	name: string
	brand: string
	price: unknown
	imageUrl: string | null
}

export type CartItemRecord = {
	id: string
	cartId: string
	perfumeId: string
	quantity: number
	createdAt: Date
	updatedAt: Date
	perfume?: CartItemPerfumeRecord
}

export type CartRecord = {
	id: string
	userId: string
	createdAt: Date
	updatedAt: Date
	items?: CartItemRecord[]
}

export type CartItemResponse = {
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

export type CartResponse = {
	id: string
	userId: string
	items: CartItemResponse[]
	totalItems: number
	totalPrice: number
}

export type AddCartItemInput = {
	perfumeId: string
	quantity: number
}

type CartItemsInclude = {
	items: {
		include: { perfume: true }
		orderBy: { createdAt: 'asc' | 'desc' }
	}
}

export type CartPrismaClient = {
	cart: {
		findUnique: (args: { where: { userId: string }; include?: CartItemsInclude }) => Promise<CartRecord | null>
		create: (args: { data: { userId: string }; include?: CartItemsInclude }) => Promise<CartRecord>
		upsert: (args: {
			where: { userId: string }
			create: { userId: string }
			update: Record<string, never>
		}) => Promise<CartRecord>
	}
	cartItem: {
		findUnique: (args: { where: { id: string } }) => Promise<CartItemRecord | null>
		upsert: (args: {
			where: { cartId_perfumeId: { cartId: string; perfumeId: string } }
			create: { cartId: string; perfumeId: string; quantity: number }
			update: { quantity: { increment: number } }
		}) => Promise<CartItemRecord>
		delete: (args: { where: { id: string } }) => Promise<CartItemRecord>
	}
	perfume: {
		findUnique: (args: { where: { id: string } }) => Promise<{ id: string } | null>
	}
}
