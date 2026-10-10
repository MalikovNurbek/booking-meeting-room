import { parseDate } from '@internationalized/date'

export const WORK_DAY_START_MINUTES = 9 * 60
export const WORK_DAY_END_MINUTES = 18 * 60
export const TIME_STEP_MINUTES = 15
export const MIN_DURATION_MINUTES = 30
export const MAX_DURATION_MINUTES = 120
export const MAX_TITLE_LENGTH = 80
export const UNTITLED_BOOKING_LABEL = 'Untitled'

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export interface TimeRange {
	start: string
	end: string
}

export interface MinuteRange {
	start: number
	end: number
}

export function isTimeString(value: unknown): value is string {
	return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function isDateString(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false
	}

	try {
		parseDate(value)

		return true
	} catch {
		return false
	}
}

export function toMinutes(time: string): number {
	const [hours, minutes] = time.split(':').map(Number) as [number, number]

	return hours * 60 + minutes
}

export function toTimeString(minutes: number): string {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60

	return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function toMinuteRange(range: TimeRange): MinuteRange {
	return { start: toMinutes(range.start), end: toMinutes(range.end) }
}

export function isAlignedToStep(
	minutes: number,
	step = TIME_STEP_MINUTES
): boolean {
	return minutes % step === 0
}

export function durationOf(range: MinuteRange): number {
	return range.end - range.start
}

/**
 * Whether two intervals overlap. Touching boundaries is not a conflict:
 * 10:00–11:00 and 11:00–12:00 are both allowed.
 */
export function overlaps(a: MinuteRange, b: MinuteRange): boolean {
	return a.start < b.end && b.start < a.end
}

/**
 * The working day grid in minutes: 540, 555, … 1080.
 * The right boundary is included — it is a valid end time.
 */
export function buildMinuteGrid(step = TIME_STEP_MINUTES): number[] {
	const grid: number[] = []

	for (
		let minutes = WORK_DAY_START_MINUTES;
		minutes <= WORK_DAY_END_MINUTES;
		minutes += step
	) {
		grid.push(minutes)
	}

	return grid
}

/** Slots a booking may start at (the end of the day is excluded). */
export function buildStartMinuteGrid(step = TIME_STEP_MINUTES): number[] {
	return buildMinuteGrid(step).filter(
		(minutes) => minutes + step <= WORK_DAY_END_MINUTES
	)
}

/** Comparing `YYYY-MM-DD` strings: lexical order matches chronological order. */
export function compareDateStrings(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0
}

export function shiftDateString(date: string, days: number): string {
	return parseDate(date).add({ days }).toString()
}
