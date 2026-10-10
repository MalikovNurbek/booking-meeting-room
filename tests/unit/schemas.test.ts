import {
	bookingDraftSchema,
	bookingPatchSchema,
	bookingQuerySchema,
} from '#shared/schemas/booking'
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'

describe('bookingDraftSchema', () => {
	it('accepts a valid request body', () => {
		const result = v.safeParse(bookingDraftSchema, {
			date: '2026-10-10',
			start: '10:00',
			end: '11:00',
			title: 'Sync',
		})

		expect(result.success).toBe(true)
	})

	it('accepts a body without a title', () => {
		const result = v.safeParse(bookingDraftSchema, {
			date: '2026-10-10',
			start: '10:00',
			end: '11:00',
		})

		expect(result.success).toBe(true)
	})

	it('trims whitespace around the title', () => {
		const result = v.safeParse(bookingDraftSchema, {
			date: '2026-10-10',
			start: '10:00',
			end: '11:00',
			title: '  Sync  ',
		})

		expect(result.success && result.output.title).toBe('Sync')
	})

	it.each([
		['a missing date', { start: '10:00', end: '11:00' }],
		['a malformed time', { date: '2026-10-10', start: '10', end: '11:00' }],
		[
			'a date that does not exist',
			{ date: '2026-02-31', start: '10:00', end: '11:00' },
		],
		[
			'an over-long title',
			{
				date: '2026-10-10',
				start: '10:00',
				end: '11:00',
				title: 'x'.repeat(81),
			},
		],
	])('rejects %s', (_label, input) => {
		expect(v.safeParse(bookingDraftSchema, input).success).toBe(false)
	})

	it('rejects a non-object', () => {
		expect(v.safeParse(bookingDraftSchema, null).success).toBe(false)
	})
})

describe('bookingPatchSchema', () => {
	it('accepts a partial update', () => {
		const result = v.safeParse(bookingPatchSchema, { end: '12:00' })

		expect(result.success).toBe(true)
		expect(result.success && result.output).toEqual({ end: '12:00' })
	})

	it('accepts an empty patch', () => {
		expect(v.safeParse(bookingPatchSchema, {}).success).toBe(true)
	})

	it('validates the fields that were sent', () => {
		expect(v.safeParse(bookingPatchSchema, { start: '25:00' }).success).toBe(
			false
		)
	})
})

describe('bookingQuerySchema', () => {
	it('requires a date in the query', () => {
		expect(v.safeParse(bookingQuerySchema, {}).success).toBe(false)
		expect(
			v.safeParse(bookingQuerySchema, { date: '2026-10-10' }).success
		).toBe(true)
	})

	it('reports the error on the date field', () => {
		const result = v.safeParse(bookingQuerySchema, { date: 'yesterday' })

		expect(result.success).toBe(false)
		expect(
			result.success === false && v.flatten(result.issues).nested
		).toHaveProperty('date')
	})
})
