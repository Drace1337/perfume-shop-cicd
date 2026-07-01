import { apiClient } from '../lib/api-client'

export type Perfume = {
	id: string
	name: string
	brand: string
	description: string | null
	price: number
	stock: number
	imageUrl: string | null
	createdAt: string
	updatedAt: string
}

export const getPerfumes = (): Promise<Perfume[]> => apiClient.get<Perfume[]>('/perfumes')

export const getPerfumeById = (id: string): Promise<Perfume> => apiClient.get<Perfume>(`/perfumes/${id}`)
