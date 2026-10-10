import { isPastMinute } from '#shared/domain/booking-rules'
import type { NowContext } from '#shared/domain/clock'
import {
	TIME_STEP_MINUTES,
	WORK_DAY_END_MINUTES,
	WORK_DAY_START_MINUTES,
	toMinutes,
	toTimeString,
} from '#shared/domain/time'
import type { Booking } from '#shared/types/booking'
import { canStartAt } from '~/utils/bookingSlots'

export const TIMELINE_ROW_COUNT =
	(WORK_DAY_END_MINUTES - WORK_DAY_START_MINUTES) / TIME_STEP_MINUTES

export interface TimelineFreeSlot {
	kind: 'free'
	key: string
	row: number
	span: number
	start: string
	startMinutes: number
	isPast: boolean
	isBookable: boolean
	isLabelled: boolean
}

export interface TimelineBooking {
	kind: 'booking'
	key: string
	row: number
	span: number
	booking: Booking
	isPast: boolean
	isOngoing: boolean
}

export type TimelineCell = TimelineFreeSlot | TimelineBooking

export interface HourLabel {
	time: string
	row: number
	span: number
}

export function rowOf(minutes: number): number {
	return (minutes - WORK_DAY_START_MINUTES) / TIME_STEP_MINUTES + 1
}

export function buildHourLabels(): HourLabel[] {
	const labels: HourLabel[] = []
	const perHour = 60 / TIME_STEP_MINUTES

	for (
		let minutes = WORK_DAY_START_MINUTES;
		minutes < WORK_DAY_END_MINUTES;
		minutes += 60
	) {
		labels.push({
			time: toTimeString(minutes),
			row: rowOf(minutes),
			span: perHour,
		})
	}

	return labels
}

export function buildTimeline(
	bookings: Booking[],
	date: string,
	now: NowContext
): TimelineCell[] {
	const ofDate = bookings
		.filter((booking) => booking.date === date)
		.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))

	const slotContext = { date, bookings, now }
	const cells: TimelineCell[] = []
	let cursor = WORK_DAY_START_MINUTES

	while (cursor < WORK_DAY_END_MINUTES) {
		const booking = ofDate.find((item) => toMinutes(item.start) === cursor)

		if (booking) {
			const start = toMinutes(booking.start)
			const end = Math.min(toMinutes(booking.end), WORK_DAY_END_MINUTES)
			const isToday = date === now.date

			cells.push({
				kind: 'booking',
				key: booking.id,
				row: rowOf(start),
				span: Math.max((end - start) / TIME_STEP_MINUTES, 1),
				booking,
				isPast: isPastMinute(date, end, now),
				isOngoing: isToday && start <= now.minutes && now.minutes < end,
			})

			cursor = Math.max(end, cursor + TIME_STEP_MINUTES)
			continue
		}

		const covered = ofDate.some(
			(item) => toMinutes(item.start) < cursor && cursor < toMinutes(item.end)
		)

		if (!covered) {
			cells.push({
				kind: 'free',
				key: `free-${cursor}`,
				row: rowOf(cursor),
				span: 1,
				start: toTimeString(cursor),
				startMinutes: cursor,
				isPast: isPastMinute(date, cursor, now),
				isBookable: canStartAt(cursor, slotContext),
				isLabelled: cursor % 30 === 0,
			})
		}

		cursor += TIME_STEP_MINUTES
	}

	return cells
}
