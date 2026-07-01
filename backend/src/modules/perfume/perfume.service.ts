import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { PerfumePrismaClient, PerfumeRecord, PerfumeResponse } from './perfume.types'

const normalizePrice = (value: unknown): number => {
	const parsed = Number(value)
	if (Number.isNaN(parsed)) {
		throw new AppError('Invalid perfume price value', 500)
	}

	return parsed
}

const toPerfumeResponse = (perfume: PerfumeRecord): PerfumeResponse => ({
	...perfume,
	price: normalizePrice(perfume.price),
})

export class PerfumeService {
	constructor(private readonly db: PerfumePrismaClient) {}

	public async getAll(): Promise<PerfumeResponse[]> {
		const perfumes = await this.db.perfume.findMany({
			orderBy: {
				createdAt: 'desc',
			},
		})

		return perfumes.map(toPerfumeResponse)
	}

	public async getById(id: string): Promise<PerfumeResponse> {
		if (!id) {
			throw new AppError('Perfume ID is required', 400)
		}

		const perfume = await this.db.perfume.findUnique({ where: { id } })
		if (!perfume) {
			throw new AppError('Perfume not found', 404)
		}

		return toPerfumeResponse(perfume)
	}
}

const prismaPerfumeClient: PerfumePrismaClient = {
	perfume: {
		findMany: args => prisma.perfume.findMany(args),
		findUnique: args => prisma.perfume.findUnique(args),
	},
}

export const perfumeService = new PerfumeService(prismaPerfumeClient)
