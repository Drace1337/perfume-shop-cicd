import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { env } from '../../config/env'
import { AuthService } from './auth.service'
import type { AuthPrismaClient, AuthUserRecord } from './auth.types'

describe('AuthService', () => {
	const findUniqueMock = jest.fn()
	const createMock = jest.fn()

	const mockPrisma: AuthPrismaClient = {
		user: {
			findUnique: findUniqueMock,
			create: createMock,
		},
	}

	const service = new AuthService(mockPrisma)

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('registers a new user with hashed password', async () => {
		findUniqueMock.mockResolvedValue(null)
		createMock.mockImplementation(async ({ data }) => {
			const createdUser: AuthUserRecord = {
				id: 'user-1',
				email: data.email,
				passwordHash: data.passwordHash,
				firstName: data.firstName,
				lastName: data.lastName,
			}
			return createdUser
		})

		const result = await service.register({
			email: 'alice@example.com',
			password: 'SecurePass123',
			firstName: 'Alice',
		})

		expect(result.user.email).toBe('alice@example.com')
		expect(result.token).toEqual(expect.any(String))

		const passwordHash = createMock.mock.calls[0][0].data.passwordHash as string
		expect(passwordHash).not.toBe('SecurePass123')
		await expect(bcrypt.compare('SecurePass123', passwordHash)).resolves.toBe(true)
	})

	it('throws 409 when user already exists', async () => {
		findUniqueMock.mockResolvedValue({
			id: 'user-2',
			email: 'existing@example.com',
			passwordHash: 'hash',
			firstName: null,
			lastName: null,
		} satisfies AuthUserRecord)

		await expect(
			service.register({
				email: 'existing@example.com',
				password: 'SecurePass123',
			}),
		).rejects.toMatchObject({ statusCode: 409 })
	})

	it('throws 401 for invalid password', async () => {
		const wrongHash = await bcrypt.hash('different-password', 12)

		findUniqueMock.mockResolvedValue({
			id: 'user-3',
			email: 'john@example.com',
			passwordHash: wrongHash,
			firstName: 'John',
			lastName: null,
		} satisfies AuthUserRecord)

		await expect(
			service.login({
				email: 'john@example.com',
				password: 'SecurePass123',
			}),
		).rejects.toMatchObject({ statusCode: 401 })
	})

	it('returns JWT token for valid login', async () => {
		const hash = await bcrypt.hash('SecurePass123', 12)

		findUniqueMock.mockResolvedValue({
			id: 'user-4',
			email: 'john@example.com',
			passwordHash: hash,
			firstName: 'John',
			lastName: 'Doe',
		} satisfies AuthUserRecord)

		const result = await service.login({
			email: 'john@example.com',
			password: 'SecurePass123',
		})

		const payload = jwt.verify(result.token, env.jwtSecret) as jwt.JwtPayload
		expect(payload.sub).toBe('user-4')
		expect(result.user.email).toBe('john@example.com')
	})
})
