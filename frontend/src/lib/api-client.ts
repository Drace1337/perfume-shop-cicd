export class ApiError extends Error {
	public readonly status: number
	public readonly details?: unknown

	constructor(message: string, status: number, details?: unknown) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.details = details
	}
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_STORAGE_KEY = 'perfume_shop_token'

const getStorage = (): Storage | null => {
	if (typeof localStorage === 'undefined') {
		return null
	}

	return localStorage
}

export const getToken = (): string | null => getStorage()?.getItem(TOKEN_STORAGE_KEY) ?? null

export const setToken = (token: string): void => {
	getStorage()?.setItem(TOKEN_STORAGE_KEY, token)
}

export const clearToken = (): void => {
	getStorage()?.removeItem(TOKEN_STORAGE_KEY)
}

type RequestOptions = {
	method?: string
	body?: unknown
	headers?: Record<string, string>
	signal?: AbortSignal
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
	const headers = new Headers(options.headers)
	headers.set('Accept', 'application/json')

	const hasBody = options.body !== undefined && options.body !== null
	if (hasBody) {
		headers.set('Content-Type', 'application/json')
	}

	const token = getToken()
	if (token) {
		headers.set('Authorization', `Bearer ${token}`)
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method: options.method ?? 'GET',
		headers,
		body: hasBody ? JSON.stringify(options.body) : undefined,
		signal: options.signal,
	})

	const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
	const payload = isJson ? await response.json() : null

	if (!response.ok) {
		const message =
			(isJson && payload && typeof payload.message === 'string' && payload.message) ||
			`Request failed with status ${response.status}`
		throw new ApiError(message, response.status, payload)
	}

	return payload as T
}

export const apiClient = {
	get: <T>(path: string, options?: RequestOptions): Promise<T> => request<T>(path, { ...options, method: 'GET' }),
	post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
		request<T>(path, { ...options, method: 'POST', body }),
	put: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
		request<T>(path, { ...options, method: 'PUT', body }),
	delete: <T>(path: string, options?: RequestOptions): Promise<T> => request<T>(path, { ...options, method: 'DELETE' }),
	getToken,
	setToken,
	clearToken,
}
