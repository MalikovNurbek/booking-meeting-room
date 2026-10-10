import { BOOKINGS_ENDPOINT } from '#shared/api-contract'
import type { Booking, BookingDraft, BookingPatch } from '#shared/types/booking'
import { toApiError } from '~/utils/apiError'

export interface BookingsApi {
	list(date: string, signal?: AbortSignal): Promise<Booking[]>
	create(draft: BookingDraft): Promise<Booking>
	update(id: string, patch: BookingPatch): Promise<Booking>
	remove(id: string): Promise<void>
}

type Fetcher = typeof $fetch

export function createHttpBookingsApi(fetcher: Fetcher = $fetch): BookingsApi {
	async function request<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation()
		} catch (error) {
			throw toApiError(error)
		}
	}

	return {
		list(date, signal) {
			return request(() =>
				fetcher<Booking[]>(BOOKINGS_ENDPOINT, {
					query: { date },
					signal,
				})
			)
		},

		create(draft) {
			return request(() =>
				fetcher<Booking>(BOOKINGS_ENDPOINT, {
					method: 'POST',
					body: draft,
				})
			)
		},

		update(id, patch) {
			return request(() =>
				fetcher<Booking>(`${BOOKINGS_ENDPOINT}/${id}`, {
					method: 'PATCH',
					body: patch,
				})
			)
		},

		async remove(id) {
			await request(() =>
				fetcher(`${BOOKINGS_ENDPOINT}/${id}`, { method: 'DELETE' })
			)
		},
	}
}

export const bookingsApi: BookingsApi = createHttpBookingsApi()
