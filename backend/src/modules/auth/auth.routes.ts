import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'
import { loginHandler, meHandler, registerHandler } from './auth.controller'

const authRouter = Router()

authRouter.post('/register', registerHandler)
authRouter.post('/login', loginHandler)
authRouter.get('/me', authMiddleware, meHandler)

export { authRouter }
