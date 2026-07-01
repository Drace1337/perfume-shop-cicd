import { Router } from 'express'

import { getPerfumeByIdHandler, getPerfumesHandler } from './perfume.controller'

const perfumeRouter = Router()

perfumeRouter.get('/', getPerfumesHandler)
perfumeRouter.get('/:id', getPerfumeByIdHandler)

export { perfumeRouter }
