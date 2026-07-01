import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { getPerfumes } from '../api/perfumes.api'
import { AuthProvider } from '../contexts/AuthContext'
import HomePage from './HomePage'

vi.mock('../api/perfumes.api', () => ({
	getPerfumes: vi.fn(),
}))

vi.mock('../api/cart.api', () => ({
	addCartItem: vi.fn(),
}))

const mockedGetPerfumes = vi.mocked(getPerfumes)

const renderHomePage = () =>
	render(
		<MemoryRouter>
			<AuthProvider>
				<HomePage />
			</AuthProvider>
		</MemoryRouter>,
	)

describe('HomePage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders the perfume catalog returned by the API', async () => {
		mockedGetPerfumes.mockResolvedValue([
			{
				id: 'perfume-1',
				name: 'Aqua Breeze',
				brand: 'Oceanic',
				description: 'Fresh scent',
				price: 199.99,
				stock: 5,
				imageUrl: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		])

		renderHomePage()

		expect(await screen.findByText('Aqua Breeze')).toBeInTheDocument()
		expect(screen.getByText('Oceanic')).toBeInTheDocument()
		expect(screen.getByText('199.99 zł')).toBeInTheDocument()
	})

	it('shows an empty state when there are no perfumes', async () => {
		mockedGetPerfumes.mockResolvedValue([])

		renderHomePage()

		await waitFor(() => {
			expect(screen.getByText('Brak perfum w katalogu.')).toBeInTheDocument()
		})
	})
})
