import { Router } from 'express'

import { authRouter } from '../modules/auth/auth.routes'
import { cartRouter } from '../modules/cart/cart.routes'
import { checkoutRouter } from '../modules/checkout/checkout.routes'
import { perfumeRouter } from '../modules/perfume/perfume.routes'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/perfumes', perfumeRouter)
apiRouter.use('/cart', cartRouter)
apiRouter.use('/checkout', checkoutRouter)

export { apiRouter }
