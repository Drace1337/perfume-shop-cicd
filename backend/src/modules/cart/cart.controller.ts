import type { RequestHandler } from 'express'

import { logger } from '../../config/logger'
import { AppError } from '../../shared/errors/app-error'
import { cartService } from './cart.service'

const getUserId = (userId: string | undefined): string => {
	if (!userId) {
		throw new AppError('Unauthorized', 401)
	}

	return userId
}

export const getCartHandler: RequestHandler = async (req, res, next) => {
	try {
		const userId = getUserId(req.user?.userId)
		const cart = await cartService.getCart(userId)
		res.status(200).json(cart)
	} catch (error) {
		next(error)
	}
}

export const addCartItemHandler: RequestHandler = async (req, res, next) => {
	try {
		const userId = getUserId(req.user?.userId)
		const cart = await cartService.addItem(userId, {
			perfumeId: typeof req.body?.perfumeId === 'string' ? req.body.perfumeId : '',
			quantity: typeof req.body?.quantity === 'number' ? req.body.quantity : 1,
		})

		logger.info('Cart item added', {
			userId,
			perfumeId: req.body?.perfumeId,
		})

		res.status(201).json(cart)
	} catch (error) {
		next(error)
	}
}

export const removeCartItemHandler: RequestHandler = async (req, res, next) => {
	try {
		const userId = getUserId(req.user?.userId)
		const cart = await cartService.removeItem(userId, req.params.id)

		logger.info('Cart item removed', {
			userId,
			itemId: req.params.id,
		})

		res.status(200).json(cart)
	} catch (error) {
		next(error)
	}
}
