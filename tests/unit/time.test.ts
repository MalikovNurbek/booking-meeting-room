import {
	buildMinuteGrid,
	buildStartMinuteGrid,
	compareDateStrings,
	durationOf,
	isAlignedToStep,
	isDateString,
	isTimeString,
	overlaps,
	shiftDateString,
	toMinuteRange,
	toMinutes,
	toTimeString,
} from '#shared/domain/time'
import { describe, expect, it } from 'vitest'

describe('toMinutes / toTimeString', () => {
	it.each([
		['00:00', 0],
		['09:00', 540],
		['09:15', 555],
		['18:00', 1080],
		['23:59', 1439],
	])('converts %s to %i minutes and back', (time, minutes) => {
		expect(toMinutes(time)).toBe(minutes)
		expect(toTimeString(minutes)).toBe(time)
	})
})

describe('isTimeString', () => {
	it.each(['09:00', '00:00', '23:59'])('accepts %s', (value) => {
		expect(isTimeString(value)).toBe(true)
	})

	it.each(['9:00', '09:60', '24:00', '09-00', '', '0900', null, 540])(
		'rejects %p',
		(value) => {
			expect(isTimeString(value)).toBe(false)
		}
	)
})

describe('isDateString', () => {
	it.each(['2026-10-10', '2024-02-29'])('accepts %s', (value) => {
		expect(isDateString(value)).toBe(true)
	})

	it('rejects dates that do not exist', () => {
		expect(isDateString('2026-02-31')).toBe(false)
		expect(isDateString('2025-02-29')).toBe(false)
	})

	it.each(['2026-13-01', '10-10-2026', '2026-1-1', '', null])(
		'rejects %p',
		(value) => {
			expect(isDateString(value)).toBe(false)
		}
	)
})

describe('isAlignedToStep', () => {
	it('accepts the 15-minute step', () => {
		expect(isAlignedToStep(toMinutes('09:15'))).toBe(true)
		expect(isAlignedToStep(toMinutes('09:30'))).toBe(true)
	})

	it('rejects times off the grid', () => {
		expect(isAlignedToStep(toMinutes('09:10'))).toBe(false)
		expect(isAlignedToStep(toMinutes('09:07'))).toBe(false)
	})
})

describe('overlaps', () => {
	it('does not treat touching boundaries as a conflict', () => {
		const first = toMinuteRange({ start: '10:00', end: '11:00' })
		const second = toMinuteRange({ start: '11:00', end: '12:00' })

		expect(overlaps(first, second)).toBe(false)
		expect(overlaps(second, first)).toBe(false)
	})

	it.each([
		['a partial overlap', '10:30', '11:30'],
		['full containment', '10:15', '10:45'],
		['identical intervals', '10:00', '11:00'],
	])('detects %s', (_label, start, end) => {
		const base = toMinuteRange({ start: '10:00', end: '11:00' })

		expect(overlaps(base, toMinuteRange({ start, end }))).toBe(true)
	})

	it('detects an interval that fully covers an existing one', () => {
		const base = toMinuteRange({ start: '10:00', end: '11:00' })

		expect(
			overlaps(base, toMinuteRange({ start: '09:30', end: '12:00' }))
		).toBe(true)
	})
})

describe('durationOf', () => {
	it('measures duration in minutes', () => {
		expect(durationOf(toMinuteRange({ start: '10:00', end: '11:30' }))).toBe(90)
	})
})

describe('buildMinuteGrid', () => {
	it('builds a 09:00–18:00 grid in 15-minute steps', () => {
		const grid = buildMinuteGrid()

		expect(grid).toHaveLength(37)
		expect(toTimeString(grid[0]!)).toBe('09:00')
		expect(toTimeString(grid.at(-1)!)).toBe('18:00')
	})

	it('excludes 18:00 from the possible start times', () => {
		const grid = buildStartMinuteGrid()

		expect(grid).toHaveLength(36)
		expect(toTimeString(grid.at(-1)!)).toBe('17:45')
	})
})

describe('compareDateStrings / shiftDateString', () => {
	it('compares dates chronologically', () => {
		expect(compareDateStrings('2026-10-09', '2026-10-10')).toBe(-1)
		expect(compareDateStrings('2026-10-10', '2026-10-10')).toBe(0)
		expect(compareDateStrings('2026-10-11', '2026-10-10')).toBe(1)
	})

	it('shifts across month and year boundaries', () => {
		expect(shiftDateString('2026-10-31', 1)).toBe('2026-11-01')
		expect(shiftDateString('2026-01-01', -1)).toBe('2025-12-31')
		expect(shiftDateString('2024-02-28', 1)).toBe('2024-02-29')
	})
})
