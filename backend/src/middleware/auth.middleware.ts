import jwt from 'jsonwebtoken'
import type { RequestHandler } from 'express'

import { env } from '../config/env'
import { logger } from '../config/logger'
import { AppError } from '../shared/errors/app-error'

type JwtPayload = {
	sub?: string
	email?: string
}

const extractToken = (authorization?: string): string | null => {
	if (!authorization) {
		return null
	}

	const [scheme, token] = authorization.split(' ')
	if (scheme !== 'Bearer' || !token) {
		return null
	}

	return token
}

export const authMiddleware: RequestHandler = (req, _res, next) => {
	const token = extractToken(req.headers.authorization)
	if (!token) {
		return next(new AppError('Unauthorized', 401))
	}

	try {
		const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
		if (!payload.sub) {
			return next(new AppError('Unauthorized', 401))
		}

		req.user = {
			userId: payload.sub,
			email: payload.email,
		}

		return next()
	} catch (error) {
		logger.warn('Invalid JWT token', {
			path: req.originalUrl,
			error: error instanceof Error ? error.message : 'Unknown JWT error',
		})
		return next(new AppError('Unauthorized', 401))
	}
}
