import type { ApiErrorBody } from '#shared/types/api'
import { describe, expect, it } from 'vitest'
import { BookingApiError, toApiError } from '~/utils/apiError'

/** How Nitro returns an error: our body sits inside the `data` envelope. */
function nitroError(statusCode: number, body: ApiErrorBody) {
	return {
		status: statusCode,
		statusCode,
		data: {
			url: '/api/bookings',
			statusCode,
			statusMessage: body.code,
			message: body.message,
			data: body,
		},
	}
}

describe('toApiError', () => {
	it('unwraps the Nitro envelope', () => {
		const error = toApiError(
			nitroError(409, {
				code: 'OVERLAP',
				message: 'Time is taken.',
				violations: [
					{
						code: 'OVERLAP',
						field: 'start',
						message: 'Time is taken.',
						conflicts: [
							{
								id: 'x',
								date: '2026-10-10',
								start: '10:00',
								end: '11:00',
								title: 'Planning',
							},
						],
					},
				],
			})
		)

		expect(error).toBeInstanceOf(BookingApiError)
		expect(error.status).toBe(409)
		expect(error.code).toBe('OVERLAP')
		expect(error.isConflict).toBe(true)
		expect(error.message).toBe('Time is taken.')
		expect(error.conflicts).toHaveLength(1)
		expect(error.fieldMessages.start).toBe('Time is taken.')
	})

	it('unwraps a body without the envelope', () => {
		const error = toApiError({
			status: 404,
			data: { code: 'NOT_FOUND', message: 'Booking not found.' },
		})

		expect(error.code).toBe('NOT_FOUND')
		expect(error.isNotFound).toBe(true)
	})

	it('maps schema errors onto fields', () => {
		const error = toApiError(
			nitroError(422, {
				code: 'BAD_REQUEST',
				message: 'Enter a time in HH:mm format.',
				fields: { start: ['Enter a time in HH:mm format.'] },
			})
		)

		expect(error.fieldMessages.start).toBe('Enter a time in HH:mm format.')
	})

	it('falls back to a readable message for a network failure', () => {
		const error = toApiError(new TypeError('Failed to fetch'))

		expect(error.status).toBe(0)
		expect(error.code).toBe('UNKNOWN')
		expect(error.message).toContain('No connection to the server')
	})

	it('falls back to a status-based message when there is no body', () => {
		const error = toApiError({ status: 500, data: 'Internal Server Error' })

		expect(error.status).toBe(500)
		expect(error.message).toContain('The server could not process the request')
	})

	it('does not re-wrap an already normalised error', () => {
		const original = new BookingApiError(409, {
			code: 'OVERLAP',
			message: 'Taken.',
		})

		expect(toApiError(original)).toBe(original)
	})

	it('handles a completely unexpected value', () => {
		expect(toApiError('something went wrong').status).toBe(0)
	})
})
