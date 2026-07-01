import dotenv from 'dotenv'

dotenv.config()

const parsePort = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
	nodeEnv: process.env.NODE_ENV ?? 'development',
	port: parsePort(process.env.PORT, 4000),
	databaseUrl:
		process.env.DATABASE_URL ?? 'postgresql://perfume_user:perfume_password@localhost:5432/perfume_shop?schema=public',
	jwtSecret: process.env.JWT_SECRET ?? 'change-me',
	jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
	corsOrigin: process.env.CORS_ORIGIN ?? '*',
	logLevel: process.env.LOG_LEVEL ?? 'info',
} as const
