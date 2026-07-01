import type { RequestHandler } from 'express'

import { AppError } from '../shared/errors/app-error'

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
	next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404))
}
