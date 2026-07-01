import { PerfumeService } from './perfume.service'
import type { PerfumePrismaClient } from './perfume.types'

describe('PerfumeService', () => {
	const findManyMock = jest.fn()
	const findUniqueMock = jest.fn()

	const mockPrisma: PerfumePrismaClient = {
		perfume: {
			findMany: findManyMock,
			findUnique: findUniqueMock,
		},
	}

	const service = new PerfumeService(mockPrisma)

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('returns all perfumes with numeric prices', async () => {
		findManyMock.mockResolvedValue([
			{
				id: 'perfume-1',
				name: 'Aqua Breeze',
				brand: 'Oceanic',
				description: 'Fresh scent',
				price: '199.99',
				stock: 5,
				imageUrl: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		])

		const result = await service.getAll()

		expect(result).toHaveLength(1)
		expect(result[0].price).toBe(199.99)
	})

	it('returns one perfume by id', async () => {
		findUniqueMock.mockResolvedValue({
			id: 'perfume-2',
			name: 'Night Oud',
			brand: 'Desert',
			description: null,
			price: 349,
			stock: 3,
			imageUrl: 'https://example.com/oud.jpg',
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		const result = await service.getById('perfume-2')

		expect(result.id).toBe('perfume-2')
		expect(result.price).toBe(349)
	})

	it('throws 404 when perfume does not exist', async () => {
		findUniqueMock.mockResolvedValue(null)

		await expect(service.getById('missing-id')).rejects.toMatchObject({
			statusCode: 404,
		})
	})
})
