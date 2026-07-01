import type { RequestHandler } from 'express'

import { logger } from '../../config/logger'
import { AppError } from '../../shared/errors/app-error'
import { checkoutService } from './checkout.service'

export const checkoutHandler: RequestHandler = async (req, res, next) => {
	try {
		const userId = req.user?.userId
		if (!userId) {
			throw new AppError('Unauthorized', 401)
		}

		const result = await checkoutService.checkout(userId)

		logger.info('Checkout completed', {
			userId,
			cartId: result.cartId,
			clearedItems: result.clearedItems,
		})

		res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}
