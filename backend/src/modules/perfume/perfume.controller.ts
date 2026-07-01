import type { RequestHandler } from 'express'

import { logger } from '../../config/logger'
import { perfumeService } from './perfume.service'

export const getPerfumesHandler: RequestHandler = async (_req, res, next) => {
	try {
		const perfumes = await perfumeService.getAll()
		logger.info('Fetched perfume catalog', { count: perfumes.length })
		res.status(200).json(perfumes)
	} catch (error) {
		next(error)
	}
}

export const getPerfumeByIdHandler: RequestHandler = async (req, res, next) => {
	try {
		const perfume = await perfumeService.getById(req.params.id)
		logger.info('Fetched perfume details', { perfumeId: req.params.id })
		res.status(200).json(perfume)
	} catch (error) {
		next(error)
	}
}
