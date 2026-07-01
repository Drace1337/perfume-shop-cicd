import { app } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { prisma } from './config/prisma'

const startServer = async (): Promise<void> => {
	try {
		await prisma.$connect()
		logger.info('Prisma connected')

		const server = app.listen(env.port, () => {
			logger.info(`Backend server listening on port ${env.port}`)
		})

		const gracefulShutdown = (signal: string): void => {
			logger.info(`Received ${signal}, shutting down...`)
			server.close(async () => {
				try {
					await prisma.$disconnect()
					logger.info('Prisma disconnected')
					process.exit(0)
				} catch (error) {
					logger.error('Error during Prisma disconnect', {
						error: error instanceof Error ? error.message : 'Unknown error',
					})
					process.exit(1)
				}
			})
		}

		process.on('SIGINT', () => gracefulShutdown('SIGINT'))
		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

		process.on('unhandledRejection', reason => {
			logger.error('Unhandled promise rejection', { reason })
		})

		process.on('uncaughtException', error => {
			logger.error('Uncaught exception', {
				error: error.message,
				stack: error.stack,
			})
			process.exit(1)
		})
	} catch (error) {
		logger.error('Failed to start backend server', {
			error: error instanceof Error ? error.message : 'Unknown bootstrap error',
		})
		process.exit(1)
	}
}

void startServer()
