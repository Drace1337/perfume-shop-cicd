import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { env } from './config/env'
import { logger } from './config/logger'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/not-found.middleware'
import { apiRouter } from './routes'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(
	cors({
		origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map(origin => origin.trim()),
	}),
)
app.use(express.json({ limit: '1mb' }))
app.use(
	morgan('combined', {
		stream: {
			write: message => logger.http(message.trim()),
		},
	}),
)

app.get('/api/health', (_req, res) => {
	res.status(200).json({ status: 'ok' })
})

app.use('/api', apiRouter)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

export { app }
