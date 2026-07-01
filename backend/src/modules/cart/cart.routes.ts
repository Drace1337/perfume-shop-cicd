import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { addCartItemHandler, getCartHandler, removeCartItemHandler } from './cart.controller'

const cartRouter = Router()

cartRouter.use(authMiddleware)
cartRouter.get('/', getCartHandler)
cartRouter.post('/items', addCartItemHandler)
cartRouter.delete('/items/:id', removeCartItemHandler)

export { cartRouter }
