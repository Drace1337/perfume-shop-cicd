import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient } from './api-client'

const TOKEN_KEY = 'perfume_shop_token'

const createMemoryStorage = (): Storage => {
	const store = new Map<string, string>()

	return {
		get length() {
			return store.size
		},
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key)
		},
		setItem: (key: string, value: string) => {
			store.set(key, value)
		},
	}
}

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	})

describe('api-client', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage())
		vi.stubGlobal('fetch', fetchMock)
		fetchMock.mockReset()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('attaches the JWT token from storage to the Authorization header', async () => {
		apiClient.setToken('test-token')
		fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

		await apiClient.get('/cart')

		const [, requestInit] = fetchMock.mock.calls[0]
		const headers = requestInit.headers as Headers
		expect(headers.get('Authorization')).toBe('Bearer test-token')
	})

	it('does not attach Authorization header when no token is stored', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

		await apiClient.get('/perfumes')

		const [, requestInit] = fetchMock.mock.calls[0]
		const headers = requestInit.headers as Headers
		expect(headers.get('Authorization')).toBeNull()
	})

	it('serializes the request body and sets the JSON content type', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ id: 'item-1' }, 201))

		await apiClient.post('/cart/items', { perfumeId: 'perfume-1', quantity: 2 })

		const [, requestInit] = fetchMock.mock.calls[0]
		const headers = requestInit.headers as Headers
		expect(headers.get('Content-Type')).toBe('application/json')
		expect(requestInit.body).toBe(JSON.stringify({ perfumeId: 'perfume-1', quantity: 2 }))
	})

	it('throws an ApiError carrying the backend status and message', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401))

		await expect(apiClient.get('/cart')).rejects.toMatchObject({
			name: 'ApiError',
			status: 401,
			message: 'Unauthorized',
		})
	})

	it('removes the token from storage on clearToken', async () => {
		apiClient.setToken('test-token')
		expect(apiClient.getToken()).toBe('test-token')

		apiClient.clearToken()

		expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
		expect(ApiError).toBeDefined()
	})
})
