import type { NowContext } from '#shared/domain/clock'
import {
	MAX_DURATION_MINUTES,
	MAX_TITLE_LENGTH,
	MIN_DURATION_MINUTES,
	TIME_STEP_MINUTES,
	UNTITLED_BOOKING_LABEL,
	WORK_DAY_END_MINUTES,
	WORK_DAY_START_MINUTES,
	compareDateStrings,
	durationOf,
	isAlignedToStep,
	isDateString,
	isTimeString,
	overlaps,
	toMinuteRange,
	toMinutes,
	toTimeString,
} from '#shared/domain/time'
import type { Booking, BookingDraft } from '#shared/types/booking'

export type ViolationCode =
	| 'INVALID_DATE'
	| 'INVALID_TIME'
	| 'UNALIGNED_TIME'
	| 'OUTSIDE_WORK_DAY'
	| 'START_NOT_BEFORE_END'
	| 'TOO_SHORT'
	| 'TOO_LONG'
	| 'PAST_DATE'
	| 'PAST_TIME'
	| 'TITLE_TOO_LONG'
	| 'OVERLAP'

export type ViolationField = 'date' | 'start' | 'end' | 'title'

export interface Violation {
	code: ViolationCode
	field?: ViolationField
	message: string
	conflicts?: Booking[]
}

export interface ValidateBookingOptions {
	bookings: Booking[]
	now: NowContext
	ignoreId?: string
	original?: Pick<Booking, 'date' | 'start'>
}

const workDayLabel = `${toTimeString(WORK_DAY_START_MINUTES)}–${toTimeString(
	WORK_DAY_END_MINUTES
)}`

function describe(booking: Booking): string {
	return `${booking.start}–${booking.end} (“${booking.title?.trim() || UNTITLED_BOOKING_LABEL}”)`
}

export function bookingsOfDate(bookings: Booking[], date: string): Booking[] {
	return bookings
		.filter((booking) => booking.date === date)
		.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

/** Bookings overlapping the interval. Touching boundaries is not a conflict. */
export function findConflicts(
	draft: Pick<BookingDraft, 'date' | 'start' | 'end'>,
	bookings: Booking[],
	ignoreId?: string
): Booking[] {
	const range = toMinuteRange(draft)

	return bookingsOfDate(bookings, draft.date).filter(
		(booking) =>
			booking.id !== ignoreId && overlaps(range, toMinuteRange(booking))
	)
}

export function isPastMinute(
	date: string,
	minutes: number,
	now: NowContext
): boolean {
	const comparison = compareDateStrings(date, now.date)

	return comparison < 0 || (comparison === 0 && minutes < now.minutes)
}

/**
 * Checks a booking draft against every rule and returns the violations found.
 * An empty array means the draft is valid.
 */
export function validateBooking(
	draft: BookingDraft,
	options: ValidateBookingOptions
): Violation[] {
	const violations: Violation[] = []

	// 0. Structure: without a valid date/start/end the rules are meaningless.
	if (!isDateString(draft.date)) {
		violations.push({
			code: 'INVALID_DATE',
			field: 'date',
			message: 'Enter a date in YYYY-MM-DD format.',
		})
	}

	for (const field of ['start', 'end'] as const) {
		if (!isTimeString(draft[field])) {
			violations.push({
				code: 'INVALID_TIME',
				field,
				message: 'Enter a time in HH:mm format.',
			})
		}
	}

	if (draft.title !== undefined && draft.title.length > MAX_TITLE_LENGTH) {
		violations.push({
			code: 'TITLE_TOO_LONG',
			field: 'title',
			message: `Title must be at most ${MAX_TITLE_LENGTH} characters.`,
		})
	}

	const hasStructuralError = violations.some(
		(violation) =>
			violation.code === 'INVALID_DATE' || violation.code === 'INVALID_TIME'
	)

	if (hasStructuralError) {
		return violations
	}

	const range = toMinuteRange(draft)

	for (const field of ['start', 'end'] as const) {
		if (!isAlignedToStep(range[field])) {
			violations.push({
				code: 'UNALIGNED_TIME',
				field,
				message: `Time must be in ${TIME_STEP_MINUTES}-minute steps.`,
			})
		}
	}

	// Rule 1. Start and end must be inside the working day.
	if (
		range.start < WORK_DAY_START_MINUTES ||
		range.start >= WORK_DAY_END_MINUTES
	) {
		violations.push({
			code: 'OUTSIDE_WORK_DAY',
			field: 'start',
			message: `Start must be within the working day (${workDayLabel}).`,
		})
	}

	if (range.end > WORK_DAY_END_MINUTES || range.end <= WORK_DAY_START_MINUTES) {
		violations.push({
			code: 'OUTSIDE_WORK_DAY',
			field: 'end',
			message: `End must be within the working day (${workDayLabel}).`,
		})
	}

	// Rule 2. start < end. Without it the duration makes no sense.
	if (range.start >= range.end) {
		violations.push({
			code: 'START_NOT_BEFORE_END',
			field: 'end',
			message: 'End must be later than start.',
		})

		return violations
	}

	// Rules 3 and 4. Duration between 30 minutes and 2 hours.
	const duration = durationOf(range)

	if (duration < MIN_DURATION_MINUTES) {
		violations.push({
			code: 'TOO_SHORT',
			field: 'end',
			message: `Minimum duration is ${MIN_DURATION_MINUTES} minutes.`,
		})
	} else if (duration > MAX_DURATION_MINUTES) {
		violations.push({
			code: 'TOO_LONG',
			field: 'end',
			message: `Maximum duration is ${MAX_DURATION_MINUTES / 60} hours.`,
		})
	}

	// Rule 6. Booking in the past is not allowed.
	const dateComparison = compareDateStrings(draft.date, options.now.date)

	if (dateComparison < 0) {
		violations.push({
			code: 'PAST_DATE',
			field: 'date',
			message: 'This date has passed — booking is unavailable.',
		})
	} else if (dateComparison === 0) {
		const startUnchanged =
			options.original !== undefined &&
			options.original.date === draft.date &&
			options.original.start === draft.start

		if (range.start < options.now.minutes && !startUnchanged) {
			violations.push({
				code: 'PAST_TIME',
				field: 'start',
				message: 'This time has passed — pick a later slot.',
			})
		}

		if (range.end <= options.now.minutes) {
			violations.push({
				code: 'PAST_TIME',
				field: 'end',
				message: 'The whole booking is in the past — pick a later time.',
			})
		}
	}

	// Rules 5 and 7. Overlaps, excluding the booking being edited.
	const conflicts = findConflicts(draft, options.bookings, options.ignoreId)

	if (conflicts.length > 0) {
		violations.push({
			code: 'OVERLAP',
			field: 'start',
			conflicts,
			message: `Time is taken: ${conflicts.map(describe).join(', ')}.`,
		})
	}

	return violations
}

/**
 * The violation that ends up in the API response.
 *
 * The order of checks in `validateBooking` is deliberate: input errors first
 * (format, working day, duration, past time) — those are 422 — and only if the
 * draft is valid on its own does a clash with other bookings remain, which is
 * 409. Reporting the first violation is therefore enough: it is the one
 * closest to what the user can actually fix.
 */
export function primaryViolation(
	violations: Violation[]
): Violation | undefined {
	return violations[0]
}
