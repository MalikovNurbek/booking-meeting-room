import { validateBooking } from '#shared/domain/booking-rules'
import { nowContext } from '#shared/domain/clock'
import { bookingDraftSchema } from '#shared/schemas/booking'
import type { Booking } from '#shared/types/booking'
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import * as v from 'valibot'
import { schemaError, violationError } from '../../utils/apiError'
import { bookingsStore } from '../../utils/bookingsStore'
import { simulateLatency } from '../../utils/latency'

export default defineEventHandler(async (event): Promise<Booking> => {
	const parsed = v.safeParse(bookingDraftSchema, await readBody(event))

	if (!parsed.success) {
		throw schemaError(parsed.issues)
	}

	await simulateLatency()

	const violations = validateBooking(parsed.output, {
		bookings: bookingsStore.all(),
		now: nowContext(),
	})

	if (violations.length > 0) {
		throw violationError(violations)
	}

	const created = bookingsStore.create(parsed.output)

	setResponseStatus(event, 201)

	return created
})
