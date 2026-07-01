import { env } from './env'

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug'

const order: Record<LogLevel, number> = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
}

const resolvedLevel: LogLevel = (Object.keys(order) as LogLevel[]).find(level => level === env.logLevel) ?? 'info'

const shouldLog = (level: LogLevel): boolean => order[level] <= order[resolvedLevel]

const writeLog = (level: LogLevel, message: string, meta?: unknown): void => {
	if (!shouldLog(level)) {
		return
	}

	const payload = {
		timestamp: new Date().toISOString(),
		level,
		message,
		...(meta ? { meta } : {}),
	}

	const line = JSON.stringify(payload)
	if (level === 'error') {
		console.error(line)
		return
	}

	if (level === 'warn') {
		console.warn(line)
		return
	}

	console.log(line)
}

export const logger = {
	error: (message: string, meta?: unknown): void => writeLog('error', message, meta),
	warn: (message: string, meta?: unknown): void => writeLog('warn', message, meta),
	info: (message: string, meta?: unknown): void => writeLog('info', message, meta),
	http: (message: string, meta?: unknown): void => writeLog('http', message, meta),
	debug: (message: string, meta?: unknown): void => writeLog('debug', message, meta),
}
