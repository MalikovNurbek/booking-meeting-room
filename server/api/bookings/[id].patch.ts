import { validateBooking } from '#shared/domain/booking-rules'
import { nowContext } from '#shared/domain/clock'
import { bookingPatchSchema } from '#shared/schemas/booking'
import type { Booking, BookingDraft } from '#shared/types/booking'
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import * as v from 'valibot'
import {
	notFoundError,
	schemaError,
	violationError,
} from '../../utils/apiError'
import { bookingsStore } from '../../utils/bookingsStore'
import { simulateLatency } from '../../utils/latency'

export default defineEventHandler(async (event): Promise<Booking> => {
	const id = getRouterParam(event, 'id')
	const existing = id ? bookingsStore.get(id) : undefined

	if (!id || !existing) {
		throw notFoundError()
	}

	const parsed = v.safeParse(bookingPatchSchema, await readBody(event))

	if (!parsed.success) {
		throw schemaError(parsed.issues)
	}

	const draft: BookingDraft = {
		date: existing.date,
		start: existing.start,
		end: existing.end,
		title: existing.title,
		...parsed.output,
	}

	await simulateLatency()

	const violations = validateBooking(draft, {
		bookings: bookingsStore.all(),
		now: nowContext(),
		ignoreId: id,
		original: existing,
	})

	if (violations.length > 0) {
		throw violationError(violations)
	}

	const updated = bookingsStore.update(id, parsed.output)

	if (!updated) {
		throw notFoundError()
	}

	return updated
})
