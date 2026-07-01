import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
	getCurrentUser,
	login as loginRequest,
	logout as logoutRequest,
	register as registerRequest,
} from '../api/auth.api'
import type { AuthUser, LoginPayload, RegisterPayload } from '../api/auth.api'
import { getToken } from '../lib/api-client'

type AuthContextValue = {
	user: AuthUser | null
	isAuthenticated: boolean
	isLoading: boolean
	login: (payload: LoginPayload) => Promise<void>
	register: (payload: RegisterPayload) => Promise<void>
	logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<AuthUser | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(true)

	useEffect(() => {
		const restoreSession = async () => {
			if (!getToken()) {
				setIsLoading(false)
				return
			}

			try {
				const { user: currentUser } = await getCurrentUser()
				setUser(currentUser)
			} catch {
				logoutRequest()
				setUser(null)
			} finally {
				setIsLoading(false)
			}
		}

		void restoreSession()
	}, [])

	const login = useCallback(async (payload: LoginPayload) => {
		const result = await loginRequest(payload)
		setUser(result.user)
	}, [])

	const register = useCallback(async (payload: RegisterPayload) => {
		const result = await registerRequest(payload)
		setUser(result.user)
	}, [])

	const logout = useCallback(() => {
		logoutRequest()
		setUser(null)
	}, [])

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			isAuthenticated: user !== null,
			isLoading,
			login,
			register,
			logout,
		}),
		[user, isLoading, login, register, logout],
	)

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}

	return context
}
