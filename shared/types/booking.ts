export interface Booking {
	id: string
	date: string
	start: string
	end: string
	title?: string
}

export type BookingDraft = Omit<Booking, 'id'>

export type BookingPatch = Partial<BookingDraft>
