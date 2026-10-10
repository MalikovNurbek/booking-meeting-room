import { bookingQuerySchema } from '#shared/schemas/booking'
import type { Booking } from '#shared/types/booking'
import { defineEventHandler, getQuery } from 'h3'
import * as v from 'valibot'
import { schemaError } from '../../utils/apiError'
import { bookingsStore } from '../../utils/bookingsStore'
import { simulateLatency } from '../../utils/latency'

export default defineEventHandler(async (event): Promise<Booking[]> => {
	const parsed = v.safeParse(bookingQuerySchema, getQuery(event))

	if (!parsed.success) {
		throw schemaError(parsed.issues)
	}

	await simulateLatency()

	return bookingsStore.byDate(parsed.output.date)
})
