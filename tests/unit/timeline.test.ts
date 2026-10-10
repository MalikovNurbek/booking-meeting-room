import type { NowContext } from '#shared/domain/clock'
import type { Booking } from '#shared/types/booking'
import { describe, expect, it } from 'vitest'
import {
	TIMELINE_ROW_COUNT,
	buildHourLabels,
	buildTimeline,
	rowOf,
} from '~/utils/timeline'
import type { TimelineFreeSlot } from '~/utils/timeline'

const DATE = '2026-10-10'
const FUTURE_DATE = '2026-10-11'
const NOW: NowContext = { date: DATE, minutes: 10 * 60 }

function booking(overrides: Partial<Booking> = {}): Booking {
	return {
		id: 'b1',
		date: DATE,
		start: '12:00',
		end: '13:00',
		title: 'Planning',
		...overrides,
	}
}

describe('rowOf / TIMELINE_ROW_COUNT', () => {
	it('maps 09:00 to the first row', () => {
		expect(rowOf(9 * 60)).toBe(1)
	})

	it('maps 15-minute steps to adjacent rows', () => {
		expect(rowOf(9 * 60 + 15)).toBe(2)
		expect(rowOf(17 * 60 + 45)).toBe(36)
	})

	it('covers the working day in 36 rows of 15 minutes', () => {
		expect(TIMELINE_ROW_COUNT).toBe(36)
	})
})

describe('buildHourLabels', () => {
	it('labels every hour of the working day', () => {
		const labels = buildHourLabels()

		expect(labels).toHaveLength(9)
		expect(labels[0]).toEqual({ time: '09:00', row: 1, span: 4 })
		expect(labels.at(-1)).toEqual({ time: '17:00', row: 33, span: 4 })
	})
})

describe('buildTimeline', () => {
	it('returns 36 free slots for an empty day', () => {
		const cells = buildTimeline([], FUTURE_DATE, NOW)

		expect(cells).toHaveLength(36)
		expect(cells.every((cell) => cell.kind === 'free')).toBe(true)
	})

	it('places a booking as a block of the right height', () => {
		const cells = buildTimeline(
			[booking({ date: FUTURE_DATE, start: '12:00', end: '13:00' })],
			FUTURE_DATE,
			NOW
		)
		const block = cells.find((cell) => cell.kind === 'booking')

		expect(block).toMatchObject({ row: rowOf(12 * 60), span: 4 })
	})

	it('creates no free slots inside a booking', () => {
		const cells = buildTimeline(
			[booking({ date: FUTURE_DATE, start: '12:00', end: '13:00' })],
			FUTURE_DATE,
			NOW
		)

		// 36 slots minus the 4 it covers, plus the booking itself.
		expect(cells).toHaveLength(36 - 4 + 1)
		expect(
			cells.filter(
				(cell) =>
					cell.kind === 'free' &&
					cell.startMinutes >= 12 * 60 &&
					cell.startMinutes < 13 * 60
			)
		).toHaveLength(0)
	})

	it('keeps the cells in chronological order', () => {
		const cells = buildTimeline(
			[
				booking({
					id: 'late',
					date: FUTURE_DATE,
					start: '15:00',
					end: '16:00',
				}),
				booking({
					id: 'early',
					date: FUTURE_DATE,
					start: '10:00',
					end: '11:00',
				}),
			],
			FUTURE_DATE,
			NOW
		)
		const rows = cells.map((cell) => cell.row)

		expect(rows).toEqual([...rows].sort((a, b) => a - b))
	})

	it('marks today’s past slots', () => {
		const cells = buildTimeline([], DATE, NOW)
		const past = cells.filter(
			(cell): cell is TimelineFreeSlot => cell.kind === 'free' && cell.isPast
		)

		// From 09:00 to 10:00 there are four slots already gone.
		expect(past).toHaveLength(4)
	})

	it('does not mark future-date slots as past', () => {
		const cells = buildTimeline([], FUTURE_DATE, NOW)

		expect(cells.some((cell) => cell.kind === 'free' && cell.isPast)).toBe(
			false
		)
	})

	it('marks a booking that is running now', () => {
		const cells = buildTimeline(
			[booking({ start: '09:30', end: '11:00' })],
			DATE,
			NOW
		)
		const block = cells.find((cell) => cell.kind === 'booking')

		expect(block).toMatchObject({ isOngoing: true, isPast: false })
	})

	it('marks a finished booking as past', () => {
		const cells = buildTimeline(
			[booking({ start: '09:00', end: '09:30' })],
			DATE,
			NOW
		)
		const block = cells.find((cell) => cell.kind === 'booking')

		expect(block).toMatchObject({ isOngoing: false, isPast: true })
	})

	it('ignores bookings on other dates', () => {
		const cells = buildTimeline(
			[booking({ date: '2026-12-01' })],
			FUTURE_DATE,
			NOW
		)

		expect(cells.every((cell) => cell.kind === 'free')).toBe(true)
	})

	it('does not allow a start where 30 minutes do not fit', () => {
		const cells = buildTimeline(
			[booking({ date: FUTURE_DATE, start: '12:00', end: '13:00' })],
			FUTURE_DATE,
			NOW
		)
		const byStart = new Map(
			cells
				.filter((cell): cell is TimelineFreeSlot => cell.kind === 'free')
				.map((cell) => [cell.start, cell])
		)

		// Only 15 minutes remain before the booking — no start here.
		expect(byStart.get('11:45')?.isBookable).toBe(false)
		expect(byStart.get('11:30')?.isBookable).toBe(true)
		// The end of the day leaves only 15 minutes too.
		expect(byStart.get('17:45')?.isBookable).toBe(false)
	})

	it('marks past slots as not bookable', () => {
		const cells = buildTimeline([], DATE, NOW)
		const first = cells.find((cell) => cell.kind === 'free')

		expect(first).toMatchObject({ isPast: true, isBookable: false })
	})

	it('labels only full and half hours', () => {
		const cells = buildTimeline([], FUTURE_DATE, NOW)
		const labelled = cells.filter(
			(cell): cell is TimelineFreeSlot => cell.kind === 'free' && cell.isLabelled
		)

		expect(labelled).toHaveLength(18)
		expect(labelled.every((cell) => cell.startMinutes % 30 === 0)).toBe(true)
	})
})
