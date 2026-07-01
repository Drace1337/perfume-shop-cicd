import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const seed = async (): Promise<void> => {
	// 1. Wyczyszczenie bazy w kolejności zgodnej z relacjami (FK).
	await prisma.cartItem.deleteMany()
	await prisma.cart.deleteMany()
	await prisma.perfume.deleteMany()
	await prisma.user.deleteMany()

	// 2. Testowy użytkownik z zahashowanym hasłem.
	const passwordHash = await bcrypt.hash('password123', 12)
	const user = await prisma.user.create({
		data: {
			email: 'test@example.com',
			passwordHash,
			firstName: 'Test',
			lastName: 'User',
			cart: {
				create: {},
			},
		},
	})

	// 3. Testowy katalog perfum.
	const perfumes = await prisma.perfume.createMany({
		data: [
			{
				name: 'Aqua Breeze',
				brand: 'Oceanic',
				description: 'Świeży, morski zapach na ciepłe dni.',
				price: '199.99',
				stock: 25,
				imageUrl: 'https://picsum.photos/seed/aqua/400/400',
			},
			{
				name: 'Night Oud',
				brand: 'Desert Bloom',
				description: 'Intensywna kompozycja oud na wieczór.',
				price: '349.50',
				stock: 12,
				imageUrl: 'https://picsum.photos/seed/oud/400/400',
			},
			{
				name: 'Citrus Spark',
				brand: 'Mediterraneo',
				description: 'Orzeźwiające nuty cytrusowe i bergamotki.',
				price: '149.00',
				stock: 40,
				imageUrl: 'https://picsum.photos/seed/citrus/400/400',
			},
			{
				name: 'Velvet Rose',
				brand: 'Maison Lumière',
				description: 'Elegancki bukiet róży z piżmem.',
				price: '279.90',
				stock: 18,
				imageUrl: 'https://picsum.photos/seed/rose/400/400',
			},
		],
	})

	console.log(
		JSON.stringify({
			message: 'Seed completed',
			userId: user.id,
			userEmail: user.email,
			perfumesCreated: perfumes.count,
		}),
	)
}

seed()
	.catch(error => {
		console.error('Seed failed', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
