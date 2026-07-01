export type PerfumeRecord = {
	id: string
	name: string
	brand: string
	description: string | null
	price: unknown
	stock: number
	imageUrl: string | null
	createdAt: Date
	updatedAt: Date
}

export type PerfumeResponse = Omit<PerfumeRecord, 'price'> & {
	price: number
}

export type PerfumePrismaClient = {
	perfume: {
		findMany: (args: { orderBy: { createdAt: 'asc' | 'desc' } }) => Promise<PerfumeRecord[]>
		findUnique: (args: { where: { id: string } }) => Promise<PerfumeRecord | null>
	}
}
