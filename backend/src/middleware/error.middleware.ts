import type { ErrorRequestHandler } from 'express'

import { env } from '../config/env'
import { logger } from '../config/logger'
import { AppError } from '../shared/errors/app-error'

export const errorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
	void next
	const isAppError = error instanceof AppError
	const statusCode = isAppError ? error.statusCode : 500
	const message = isAppError ? error.message : 'Internal server error'

	logger.error('Request failed', {
		method: req.method,
		path: req.originalUrl,
		statusCode,
		error: error instanceof Error ? error.message : 'Unknown error',
		stack: error instanceof Error ? error.stack : undefined,
	})

	res.status(statusCode).json({
		message,
		...(env.nodeEnv !== 'production' && isAppError && error.details ? { details: error.details } : {}),
	})
}
