import bcrypt from 'bcrypt'
import jwt, { type SignOptions } from 'jsonwebtoken'

import { env } from '../../config/env'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { AuthPrismaClient, AuthResponse, AuthUserRecord, LoginInput, RegisterInput } from './auth.types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class AuthService {
	constructor(private readonly db: AuthPrismaClient) {}

	public async register(input: RegisterInput): Promise<AuthResponse> {
		this.validateRegisterInput(input)

		const normalizedEmail = input.email.trim().toLowerCase()
		const existingUser = await this.db.user.findUnique({ where: { email: normalizedEmail } })
		if (existingUser) {
			throw new AppError('User with this email already exists', 409)
		}

		const passwordHash = await bcrypt.hash(input.password, 12)
		const user = await this.db.user.create({
			data: {
				email: normalizedEmail,
				passwordHash,
				firstName: input.firstName?.trim() || null,
				lastName: input.lastName?.trim() || null,
			},
		})

		return this.buildAuthResponse(user)
	}

	public async login(input: LoginInput): Promise<AuthResponse> {
		this.validateLoginInput(input)

		const normalizedEmail = input.email.trim().toLowerCase()
		const user = await this.db.user.findUnique({ where: { email: normalizedEmail } })

		if (!user) {
			throw new AppError('Invalid email or password', 401)
		}

		const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)
		if (!isPasswordValid) {
			throw new AppError('Invalid email or password', 401)
		}

		return this.buildAuthResponse(user)
	}

	private validateRegisterInput(input: RegisterInput): void {
		if (!input.email || !input.password) {
			throw new AppError('Email and password are required', 400)
		}

		if (!emailPattern.test(input.email.trim().toLowerCase())) {
			throw new AppError('Invalid email format', 400)
		}

		if (input.password.length < 8) {
			throw new AppError('Password must contain at least 8 characters', 400)
		}
	}

	private validateLoginInput(input: LoginInput): void {
		if (!input.email || !input.password) {
			throw new AppError('Email and password are required', 400)
		}
	}

	private buildAuthResponse(user: AuthUserRecord): AuthResponse {
		const publicUser = {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
		}

		const signOptions: SignOptions = {
			expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
		}

		const token = jwt.sign(
			{
				sub: user.id,
				email: user.email,
			},
			env.jwtSecret,
			signOptions,
		)

		return {
			token,
			user: publicUser,
		}
	}
}

const prismaAuthClient: AuthPrismaClient = {
	user: {
		findUnique: args => prisma.user.findUnique(args),
		create: args => prisma.user.create(args),
	},
}

export const authService = new AuthService(prismaAuthClient)
