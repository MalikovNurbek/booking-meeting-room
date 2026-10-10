import type { BookingFormState } from '#shared/schemas/booking'
import type { BookingDraft } from '#shared/types/booking'

export function toBookingDraft(data: Partial<BookingFormState>): BookingDraft {
	return {
		date: data.date ?? '',
		start: data.start ?? '',
		end: data.end ?? '',
		title: data.title?.trim() ?? '',
	}
}
