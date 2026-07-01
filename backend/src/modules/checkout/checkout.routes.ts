import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { checkoutHandler } from './checkout.controller'

const checkoutRouter = Router()

checkoutRouter.use(authMiddleware)
checkoutRouter.post('/', checkoutHandler)

export { checkoutRouter }
