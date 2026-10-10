/**
 * The API handlers under a real h3 router: real routing, real request bodies,
 * real status codes — without building the whole Nuxt app.
 *
 * Dates are always in the future so the suite does not depend on the hour it
 * runs at; the time-sensitive rules are covered deterministically in the
 * domain tests, where "now" is injected.
 */
import { nowContext } from '#shared/domain/clock'
import { shiftDateString } from '#shared/domain/time'
import type { Booking } from '#shared/types/booking'
import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import deleteBooking from '~~/server/api/bookings/[id].delete'
import patchBooking from '~~/server/api/bookings/[id].patch'
import getBookings from '~~/server/api/bookings/index.get'
import postBooking from '~~/server/api/bookings/index.post'
import { bookingsStore } from '~~/server/utils/bookingsStore'

const router = createRouter()

router.get('/api/bookings', getBookings)
router.post('/api/bookings', postBooking)
router.patch('/api/bookings/:id', patchBooking)
router.delete('/api/bookings/:id', deleteBooking)

const handler = toWebHandler(createApp().use(router))

/** A date far enough ahead that no rule about the past can interfere. */
const FUTURE = shiftDateString(nowContext().date, 7)

interface ApiResponse<T> {
	status: number
	body: T
}

async function call<T = unknown>(
	method: string,
	path: string,
	options: { body?: unknown } = {}
): Promise<ApiResponse<T>> {
	const response = await handler(
		new Request(`http://test${path}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body:
				options.body === undefined ? undefined : JSON.stringify(options.body),
		})
	)

	const text = await response.text()

	return {
		status: response.status,
		body: text ? JSON.parse(text) : (undefined as T),
	}
}

/** Error code regardless of how the error envelope is shaped. */
function errorCode(body: unknown): string | undefined {
	const record = body as { statusMessage?: string; data?: { code?: string } }

	return record?.data?.code ?? record?.statusMessage
}

function bookingsOn(date: string): Booking[] {
	return bookingsStore.all().filter((booking) => booking.date === date)
}

beforeAll(() => {
	process.env.MOCK_LATENCY_MS = '0'
})

beforeEach(() => {
	bookingsStore.reset([])
})

describe('GET /api/bookings', () => {
	it('returns the bookings of the requested date', async () => {
		await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:00', end: '11:00', title: 'Interview' },
		})

		const { status, body } = await call<Booking[]>(
			'GET',
			`/api/bookings?date=${FUTURE}`
		)

		expect(status).toBe(200)
		expect(body).toHaveLength(1)
		expect(body[0]).toMatchObject({ start: '10:00', title: 'Interview' })
	})

	it('rejects a missing date', async () => {
		const { status, body } = await call('GET', '/api/bookings')

		expect(status).toBe(422)
		expect(errorCode(body)).toBe('BAD_REQUEST')
	})
})

describe('POST /api/bookings', () => {
	it('creates a booking', async () => {
		const { status, body } = await call<Booking>('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:00', end: '11:00' },
		})

		expect(status).toBe(201)
		expect(body.id).toBeTruthy()
		expect(bookingsOn(FUTURE)).toHaveLength(1)
	})

	it('answers 409 on an overlap', async () => {
		await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:00', end: '11:00' },
		})

		const { status, body } = await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:30', end: '11:30' },
		})

		expect(status).toBe(409)
		expect(errorCode(body)).toBe('OVERLAP')
		expect(bookingsOn(FUTURE)).toHaveLength(1)
	})

	it('answers 422 on a rule violation', async () => {
		const { status, body } = await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: '14:00', end: '14:15' },
		})

		expect(status).toBe(422)
		expect(errorCode(body)).toBe('TOO_SHORT')
	})
})

describe('a rejected request never writes to the store', () => {
	it('leaves the store untouched after a rule violation', async () => {
		const { status } = await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: '14:00', end: '14:15' },
		})

		expect(status).toBe(422)
		expect(bookingsOn(FUTURE)).toEqual([])
	})

	it('leaves the store untouched after a malformed body', async () => {
		const { status } = await call('POST', '/api/bookings', {
			body: { date: FUTURE, start: 'noon' },
		})

		expect(status).toBe(422)
		expect(bookingsOn(FUTURE)).toEqual([])
	})

	it('leaves the booking untouched after a failed update', async () => {
		const { body: created } = await call<Booking>('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:00', end: '11:00', title: 'Before' },
		})

		const { status } = await call('PATCH', `/api/bookings/${created.id}`, {
			body: { end: '10:10' },
		})

		expect(status).toBe(422)
		expect(bookingsOn(FUTURE)[0]).toMatchObject({
			end: '11:00',
			title: 'Before',
		})
	})
})

describe('PATCH /api/bookings/:id', () => {
	async function createBooking(
		overrides: Partial<Booking> = {}
	): Promise<Booking> {
		const { body } = await call<Booking>('POST', '/api/bookings', {
			body: {
				date: FUTURE,
				start: '10:00',
				end: '11:00',
				title: 'Interview',
				...overrides,
			},
		})

		return body
	}

	it('updates the fields that were sent', async () => {
		const booking = await createBooking()

		const { status, body } = await call<Booking>(
			'PATCH',
			`/api/bookings/${booking.id}`,
			{ body: { end: '11:30' } }
		)

		expect(status).toBe(200)
		expect(body).toMatchObject({ start: '10:00', end: '11:30' })
	})

	it('keeps the title when the key is absent', async () => {
		const booking = await createBooking()

		const { body } = await call<Booking>(
			'PATCH',
			`/api/bookings/${booking.id}`,
			{ body: { end: '11:30' } }
		)

		expect(body.title).toBe('Interview')
	})

	it('clears the title when an empty one is sent (regression)', async () => {
		// This is the payload the form produces once the title field is
		// emptied; omitting the key would silently keep the old title.
		const booking = await createBooking()

		const { status, body } = await call<Booking>(
			'PATCH',
			`/api/bookings/${booking.id}`,
			{ body: { date: FUTURE, start: '10:00', end: '11:00', title: '' } }
		)

		expect(status).toBe(200)
		expect(body.title).toBeUndefined()
	})

	it('does not conflict with itself', async () => {
		const booking = await createBooking()

		const { status } = await call('PATCH', `/api/bookings/${booking.id}`, {
			body: { date: FUTURE, start: '10:00', end: '11:00' },
		})

		expect(status).toBe(200)
	})

	it('answers 409 when the new interval hits another booking', async () => {
		const booking = await createBooking()
		await createBooking({ start: '12:00', end: '13:00', title: 'Other' })

		const { status, body } = await call(
			'PATCH',
			`/api/bookings/${booking.id}`,
			{ body: { start: '11:30', end: '12:30' } }
		)

		expect(status).toBe(409)
		expect(errorCode(body)).toBe('OVERLAP')
	})

	it('answers 404 for an unknown id', async () => {
		const { status, body } = await call('PATCH', '/api/bookings/missing', {
			body: { end: '12:00' },
		})

		expect(status).toBe(404)
		expect(errorCode(body)).toBe('NOT_FOUND')
	})
})

describe('DELETE /api/bookings/:id', () => {
	it('deletes a booking and reports 404 afterwards', async () => {
		const { body: created } = await call<Booking>('POST', '/api/bookings', {
			body: { date: FUTURE, start: '10:00', end: '11:00' },
		})

		const first = await call('DELETE', `/api/bookings/${created.id}`)
		const second = await call('DELETE', `/api/bookings/${created.id}`)

		expect(first.status).toBe(204)
		expect(second.status).toBe(404)
		expect(bookingsOn(FUTURE)).toEqual([])
	})
})
