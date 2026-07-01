import { apiClient, clearToken, setToken } from '../lib/api-client'

export type AuthUser = {
	id: string
	email: string
	firstName: string | null
	lastName: string | null
}

export type AuthResponse = {
	token: string
	user: AuthUser
}

export type RegisterPayload = {
	email: string
	password: string
	firstName?: string
	lastName?: string
}

export type LoginPayload = {
	email: string
	password: string
}

export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
	const result = await apiClient.post<AuthResponse>('/auth/register', payload)
	setToken(result.token)
	return result
}

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
	const result = await apiClient.post<AuthResponse>('/auth/login', payload)
	setToken(result.token)
	return result
}

export const getCurrentUser = (): Promise<{ user: AuthUser }> => apiClient.get<{ user: AuthUser }>('/auth/me')

export const logout = (): void => {
	clearToken()
}
