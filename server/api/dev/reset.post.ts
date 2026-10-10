import type { Booking } from '#shared/types/booking'
import { defineEventHandler } from 'h3'
import { bookingsStore } from '../../utils/bookingsStore'

export default defineEventHandler((): { bookings: Booking[] } => {
	bookingsStore.reset()

	return { bookings: bookingsStore.all() }
})
