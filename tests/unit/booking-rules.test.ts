import {
	bookingsOfDate,
	findConflicts,
	isPastMinute,
	primaryViolation,
	validateBooking,
} from '#shared/domain/booking-rules'
import type {
	ValidateBookingOptions,
	ViolationCode,
} from '#shared/domain/booking-rules'
import type { NowContext } from '#shared/domain/clock'
import type { Booking, BookingDraft } from '#shared/types/booking'
import { describe, expect, it } from 'vitest'

const TODAY = '2026-10-10'
const YESTERDAY = '2026-10-09'
const TOMORROW = '2026-10-11'

/** Today at 10:00 — the middle of the working day. */
const NOW: NowContext = { date: TODAY, minutes: 10 * 60 }

function booking(overrides: Partial<Booking> = {}): Booking {
	return {
		id: 'existing',
		date: TODAY,
		start: '12:00',
		end: '13:00',
		title: 'Planning',
		...overrides,
	}
}

function draft(overrides: Partial<BookingDraft> = {}): BookingDraft {
	return { date: TOMORROW, start: '10:00', end: '11:00', ...overrides }
}

function validate(
	input: BookingDraft,
	options: Partial<ValidateBookingOptions> = {}
) {
	return validateBooking(input, { bookings: [], now: NOW, ...options })
}

function codes(
	input: BookingDraft,
	options: Partial<ValidateBookingOptions> = {}
): ViolationCode[] {
	return validate(input, options).map((violation) => violation.code)
}

describe('validateBooking: the happy path', () => {
	it('returns no violations for a valid booking', () => {
		expect(validate(draft())).toEqual([])
	})

	it('accepts a booking without a title', () => {
		expect(validate(draft({ title: undefined }))).toEqual([])
	})
})

describe('input structure', () => {
	it('requires a valid date', () => {
		expect(codes(draft({ date: '10.10.2026' }))).toContain('INVALID_DATE')
	})

	it('requires a valid time', () => {
		expect(codes(draft({ start: '9:00' }))).toContain('INVALID_TIME')
	})

	it('skips business rules when the structure is broken', () => {
		expect(codes(draft({ start: 'nope', end: 'nope' }))).toEqual([
			'INVALID_TIME',
			'INVALID_TIME',
		])
	})

	it('limits the title length', () => {
		expect(codes(draft({ title: 'x'.repeat(81) }))).toContain('TITLE_TOO_LONG')
	})
})

describe('rule 1: within the working day 09:00–18:00', () => {
	it('accepts the exact day boundaries', () => {
		expect(validate(draft({ start: '09:00', end: '10:00' }))).toEqual([])
		expect(validate(draft({ start: '17:00', end: '18:00' }))).toEqual([])
	})

	it('rejects a start before 09:00', () => {
		expect(codes(draft({ start: '08:30', end: '09:30' }))).toContain(
			'OUTSIDE_WORK_DAY'
		)
	})

	it('rejects an end after 18:00', () => {
		expect(codes(draft({ start: '17:30', end: '18:30' }))).toContain(
			'OUTSIDE_WORK_DAY'
		)
	})
})

describe('rule 2: start < end', () => {
	it('rejects equal values', () => {
		expect(codes(draft({ start: '10:00', end: '10:00' }))).toContain(
			'START_NOT_BEFORE_END'
		)
	})

	it('rejects an end before the start', () => {
		expect(codes(draft({ start: '11:00', end: '10:00' }))).toContain(
			'START_NOT_BEFORE_END'
		)
	})

	it('skips the duration check when the order is wrong', () => {
		expect(codes(draft({ start: '11:00', end: '10:00' }))).not.toContain(
			'TOO_SHORT'
		)
	})
})

describe('rules 3 and 4: duration between 30 minutes and 2 hours', () => {
	it('accepts exactly 30 minutes', () => {
		expect(validate(draft({ start: '10:00', end: '10:30' }))).toEqual([])
	})

	it('accepts exactly 2 hours', () => {
		expect(validate(draft({ start: '10:00', end: '12:00' }))).toEqual([])
	})

	it('rejects 15 minutes', () => {
		expect(codes(draft({ start: '10:00', end: '10:15' }))).toContain(
			'TOO_SHORT'
		)
	})

	it('rejects 2 hours 15 minutes', () => {
		expect(codes(draft({ start: '10:00', end: '12:15' }))).toContain('TOO_LONG')
	})
})

describe('the 15-minute grid step', () => {
	it('rejects times off the grid', () => {
		expect(codes(draft({ start: '10:10', end: '11:10' }))).toEqual([
			'UNALIGNED_TIME',
			'UNALIGNED_TIME',
		])
	})

	it('accepts quarter hours', () => {
		expect(validate(draft({ start: '10:15', end: '10:45' }))).toEqual([])
	})
})

describe('rule 5: overlaps', () => {
	const existing = [booking({ date: TOMORROW, start: '10:00', end: '11:00' })]

	it('does not treat touching boundaries as a conflict', () => {
		expect(
			validate(draft({ start: '11:00', end: '12:00' }), { bookings: existing })
		).toEqual([])
		expect(
			validate(draft({ start: '09:00', end: '10:00' }), { bookings: existing })
		).toEqual([])
	})

	it('rejects an overlap and reports what it clashes with', () => {
		const violations = validate(draft({ start: '10:30', end: '11:30' }), {
			bookings: existing,
		})

		expect(violations).toHaveLength(1)
		expect(violations[0]?.code).toBe('OVERLAP')
		expect(violations[0]?.conflicts).toEqual(existing)
		expect(violations[0]?.message).toContain('10:00–11:00')
	})

	it('ignores bookings on other dates', () => {
		expect(
			validate(draft({ start: '10:00', end: '11:00' }), {
				bookings: [booking({ date: TODAY, start: '10:00', end: '11:00' })],
			})
		).toEqual([])
	})
})

describe('rule 6: no booking in the past', () => {
	it('rejects a past date', () => {
		expect(codes(draft({ date: YESTERDAY }))).toContain('PAST_DATE')
	})

	it('rejects a slot that already passed today', () => {
		expect(
			codes(draft({ date: TODAY, start: '09:00', end: '09:30' }))
		).toContain('PAST_TIME')
	})

	it('accepts a slot starting exactly now', () => {
		expect(
			validate(draft({ date: TODAY, start: '10:00', end: '11:00' }))
		).toEqual([])
	})

	it('does not restrict future dates', () => {
		expect(
			validate(draft({ date: TOMORROW, start: '09:00', end: '09:30' }))
		).toEqual([])
	})
})

describe('rule 7: an edit never conflicts with itself', () => {
	const existing = booking({
		id: 'current',
		date: TOMORROW,
		start: '10:00',
		end: '11:00',
	})

	it('excludes the edited booking from the overlap check', () => {
		expect(
			validate(draft({ start: '10:00', end: '11:00' }), {
				bookings: [existing],
				ignoreId: 'current',
			})
		).toEqual([])
	})

	it('still detects clashes with other bookings', () => {
		const other = booking({
			id: 'other',
			date: TOMORROW,
			start: '11:00',
			end: '12:00',
		})

		expect(
			codes(draft({ start: '10:30', end: '11:30' }), {
				bookings: [existing, other],
				ignoreId: 'current',
			})
		).toContain('OVERLAP')
	})
})

describe('editing a booking that already started', () => {
	// It is 10:00 now; the booking runs from 09:30 to 11:00.
	const ongoing = booking({
		id: 'ongoing',
		date: TODAY,
		start: '09:30',
		end: '11:00',
	})

	it('allows edits while the start stays unchanged', () => {
		expect(
			validate(
				{ date: TODAY, start: '09:30', end: '11:00', title: 'New title' },
				{
					bookings: [ongoing],
					ignoreId: 'ongoing',
					original: ongoing,
				}
			)
		).toEqual([])
	})

	it('allows extending the booking within 2 hours', () => {
		expect(
			validate(
				{ date: TODAY, start: '09:30', end: '11:30' },
				{ bookings: [ongoing], ignoreId: 'ongoing', original: ongoing }
			)
		).toEqual([])
	})

	it('forbids moving the start into the past', () => {
		expect(
			codes(
				{ date: TODAY, start: '09:15', end: '11:00' },
				{ bookings: [ongoing], ignoreId: 'ongoing', original: ongoing }
			)
		).toContain('PAST_TIME')
	})

	it('forbids pushing the whole booking into the past', () => {
		expect(
			codes(
				{ date: TODAY, start: '09:30', end: '10:00' },
				{ bookings: [ongoing], ignoreId: 'ongoing', original: ongoing }
			)
		).toContain('PAST_TIME')
	})
})

describe('moving a booking onto today (regression)', () => {
	// The booking lives tomorrow at 15:00–17:00; "now" is today at 10:00,
	// so 15:00 is still in the future tomorrow but 09:00 already passed today.
	const elsewhere = booking({
		id: 'elsewhere',
		date: TOMORROW,
		start: '09:00',
		end: '11:00',
	})

	it('rejects a move onto today when the start has already passed', () => {
		// Same start time, different date: the "already started" exemption
		// must not apply, or the booking would begin an hour in the past.
		expect(
			codes(
				{ date: TODAY, start: '09:00', end: '11:00' },
				{
					bookings: [elsewhere],
					ignoreId: 'elsewhere',
					original: elsewhere,
				}
			)
		).toContain('PAST_TIME')
	})

	it('matches what creating the same booking would do', () => {
		const onCreate = codes({ date: TODAY, start: '09:00', end: '11:00' })
		const onMove = codes(
			{ date: TODAY, start: '09:00', end: '11:00' },
			{ bookings: [elsewhere], ignoreId: 'elsewhere', original: elsewhere }
		)

		expect(onMove).toEqual(onCreate)
	})

	it('still allows a move onto today at a time that has not passed', () => {
		expect(
			validate(
				{ date: TODAY, start: '14:00', end: '16:00' },
				{ bookings: [elsewhere], ignoreId: 'elsewhere', original: elsewhere }
			)
		).toEqual([])
	})

	it('keeps the exemption for a booking that stays on its own date', () => {
		const ongoing = booking({
			id: 'ongoing',
			date: TODAY,
			start: '09:30',
			end: '11:00',
		})

		expect(
			validate(
				{ date: TODAY, start: '09:30', end: '11:00', title: 'Renamed' },
				{ bookings: [ongoing], ignoreId: 'ongoing', original: ongoing }
			)
		).toEqual([])
	})
})

describe('findConflicts / bookingsOfDate / isPastMinute', () => {
	it('sorts the day bookings by start time', () => {
		const bookings = [
			booking({ id: 'b', start: '14:00', end: '15:00' }),
			booking({ id: 'a', start: '09:00', end: '09:30' }),
		]

		expect(bookingsOfDate(bookings, TODAY).map((item) => item.id)).toEqual([
			'a',
			'b',
		])
	})

	it('returns the clashing bookings', () => {
		const bookings = [booking({ start: '12:00', end: '13:00' })]

		expect(
			findConflicts({ date: TODAY, start: '12:30', end: '13:30' }, bookings)
		).toHaveLength(1)
	})

	it('detects minutes that have passed', () => {
		expect(isPastMinute(TODAY, 9 * 60, NOW)).toBe(true)
		expect(isPastMinute(TODAY, 10 * 60, NOW)).toBe(false)
		expect(isPastMinute(YESTERDAY, 17 * 60, NOW)).toBe(true)
		expect(isPastMinute(TOMORROW, 9 * 60, NOW)).toBe(false)
	})
})

describe('primaryViolation', () => {
	it('prefers an input error over a clash', () => {
		// The slot is both taken and past: the time is the more useful answer.
		const violations = validate(
			{ date: TODAY, start: '09:00', end: '09:30' },
			{ bookings: [booking({ start: '09:00', end: '09:30' })] }
		)

		expect(violations.map((violation) => violation.code)).toContain('OVERLAP')
		expect(primaryViolation(violations)?.code).toBe('PAST_TIME')
	})

	it('reports the clash when the draft is otherwise valid', () => {
		const violations = validate(draft({ start: '10:00', end: '11:00' }), {
			bookings: [booking({ date: TOMORROW, start: '10:00', end: '11:00' })],
		})

		expect(primaryViolation(violations)?.code).toBe('OVERLAP')
	})

	it('returns undefined for an empty list', () => {
		expect(primaryViolation([])).toBeUndefined()
	})
})
