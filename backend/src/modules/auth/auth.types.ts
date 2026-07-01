export type AuthUserRecord = {
	id: string
	email: string
	passwordHash: string
	firstName: string | null
	lastName: string | null
}

export type RegisterInput = {
	email: string
	password: string
	firstName?: string
	lastName?: string
}

export type LoginInput = {
	email: string
	password: string
}

export type AuthResponse = {
	token: string
	user: {
		id: string
		email: string
		firstName: string | null
		lastName: string | null
	}
}

export type AuthPrismaClient = {
	user: {
		findUnique: (args: { where: { email: string } }) => Promise<AuthUserRecord | null>
		create: (args: {
			data: {
				email: string
				passwordHash: string
				firstName: string | null
				lastName: string | null
			}
		}) => Promise<AuthUserRecord>
	}
}
