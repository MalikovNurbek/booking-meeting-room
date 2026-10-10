import { bookingsOfDate, isPastMinute } from '#shared/domain/booking-rules'
import type { NowContext } from '#shared/domain/clock'
import {
	MAX_DURATION_MINUTES,
	MIN_DURATION_MINUTES,
	TIME_STEP_MINUTES,
	WORK_DAY_END_MINUTES,
	buildMinuteGrid,
	buildStartMinuteGrid,
	toMinutes,
	toTimeString,
} from '#shared/domain/time'
import type { Booking } from '#shared/types/booking'
import { formatDuration } from '~/utils/format'

export interface TimeOption {
	label: string
	value: string
	disabled?: boolean
}

export interface SlotContext {
	date: string
	bookings: Booking[]
	now: NowContext
	ignoreId?: string
}

function relevantBookings(context: SlotContext): Booking[] {
	return bookingsOfDate(context.bookings, context.date).filter(
		(booking) => booking.id !== context.ignoreId
	)
}

export function isSlotOccupied(minutes: number, context: SlotContext): boolean {
	return relevantBookings(context).some(
		(booking) =>
			toMinutes(booking.start) <= minutes && minutes < toMinutes(booking.end)
	)
}

export function maxEndMinutes(
	startMinutes: number,
	context: SlotContext
): number {
	const nextBookingStart = relevantBookings(context)
		.map((booking) => toMinutes(booking.start))
		.filter((start) => start >= startMinutes)
		.at(0)

	return Math.min(
		startMinutes + MAX_DURATION_MINUTES,
		WORK_DAY_END_MINUTES,
		nextBookingStart ?? Number.POSITIVE_INFINITY
	)
}

export function canStartAt(
	startMinutes: number,
	context: SlotContext
): boolean {
	if (isPastMinute(context.date, startMinutes, context.now)) {
		return false
	}

	if (isSlotOccupied(startMinutes, context)) {
		return false
	}

	return (
		maxEndMinutes(startMinutes, context) - startMinutes >= MIN_DURATION_MINUTES
	)
}

export function buildStartOptions(context: SlotContext): TimeOption[] {
	return buildStartMinuteGrid().map((minutes) => {
		const value = toTimeString(minutes)

		return {
			label: value,
			value,
			disabled: !canStartAt(minutes, context),
		}
	})
}

export function buildEndOptions(
	start: string,
	context: SlotContext
): TimeOption[] {
	const startMinutes = toMinutes(start)
	const limit = maxEndMinutes(startMinutes, context)

	return buildMinuteGrid()
		.filter(
			(minutes) =>
				minutes >= startMinutes + MIN_DURATION_MINUTES && minutes <= limit
		)
		.map((minutes) => ({
			label: `${toTimeString(minutes)} · ${formatDuration(minutes - startMinutes)}`,
			value: toTimeString(minutes),
		}))
}

export function firstAvailableStart(context: SlotContext): string | undefined {
	const minutes = buildStartMinuteGrid().find((candidate) =>
		canStartAt(candidate, context)
	)

	return minutes === undefined ? undefined : toTimeString(minutes)
}

/** Default end: the minimum duration, but never past the allowed limit. */
export function defaultEndFor(start: string, context: SlotContext): string {
	const startMinutes = toMinutes(start)
	const limit = maxEndMinutes(startMinutes, context)
	const preferred = startMinutes + MIN_DURATION_MINUTES

	return toTimeString(
		Math.min(Math.max(preferred, startMinutes + TIME_STEP_MINUTES), limit)
	)
}
