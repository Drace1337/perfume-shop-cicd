import type { RequestHandler } from 'express'

import { logger } from '../../config/logger'
import { authService } from './auth.service'

export const registerHandler: RequestHandler = async (req, res, next) => {
	try {
		const result = await authService.register({
			email: typeof req.body?.email === 'string' ? req.body.email : '',
			password: typeof req.body?.password === 'string' ? req.body.password : '',
			firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : undefined,
			lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : undefined,
		})

		logger.info('User registered', {
			userId: result.user.id,
			email: result.user.email,
		})

		res.status(201).json(result)
	} catch (error) {
		next(error)
	}
}

export const loginHandler: RequestHandler = async (req, res, next) => {
	try {
		const result = await authService.login({
			email: typeof req.body?.email === 'string' ? req.body.email : '',
			password: typeof req.body?.password === 'string' ? req.body.password : '',
		})

		logger.info('User logged in', {
			userId: result.user.id,
			email: result.user.email,
		})

		res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}

export const meHandler: RequestHandler = (req, res) => {
	res.status(200).json({
		user: req.user,
	})
}
