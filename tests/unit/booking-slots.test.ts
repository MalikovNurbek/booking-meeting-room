import type { NowContext } from '#shared/domain/clock'
import { toMinutes } from '#shared/domain/time'
import type { Booking } from '#shared/types/booking'
import { describe, expect, it } from 'vitest'
import {
	buildEndOptions,
	buildStartOptions,
	canStartAt,
	defaultEndFor,
	firstAvailableStart,
	isSlotOccupied,
	maxEndMinutes,
} from '~/utils/bookingSlots'
import type { SlotContext } from '~/utils/bookingSlots'

const TODAY = '2026-10-10'
const TOMORROW = '2026-10-11'
const NOW: NowContext = { date: TODAY, minutes: 10 * 60 }

function booking(overrides: Partial<Booking> = {}): Booking {
	return {
		id: 'b1',
		date: TOMORROW,
		start: '12:00',
		end: '13:00',
		...overrides,
	}
}

function context(overrides: Partial<SlotContext> = {}): SlotContext {
	return { date: TOMORROW, bookings: [], now: NOW, ...overrides }
}

describe('isSlotOccupied', () => {
	const ctx = context({ bookings: [booking()] })

	it('treats slots inside a booking as taken', () => {
		expect(isSlotOccupied(toMinutes('12:00'), ctx)).toBe(true)
		expect(isSlotOccupied(toMinutes('12:45'), ctx)).toBe(true)
	})

	it('does not take the slot starting exactly at the end', () => {
		expect(isSlotOccupied(toMinutes('13:00'), ctx)).toBe(false)
	})

	it('ignores the booking being edited', () => {
		const editing = context({ bookings: [booking()], ignoreId: 'b1' })

		expect(isSlotOccupied(toMinutes('12:00'), editing)).toBe(false)
	})
})

describe('maxEndMinutes', () => {
	it('caps at the maximum duration', () => {
		expect(maxEndMinutes(toMinutes('10:00'), context())).toBe(
			toMinutes('12:00')
		)
	})

	it('caps at the end of the working day', () => {
		expect(maxEndMinutes(toMinutes('17:00'), context())).toBe(
			toMinutes('18:00')
		)
	})

	it('caps at the start of the next booking', () => {
		const ctx = context({
			bookings: [booking({ start: '11:00', end: '12:00' })],
		})

		expect(maxEndMinutes(toMinutes('10:00'), ctx)).toBe(toMinutes('11:00'))
	})
})

describe('canStartAt', () => {
	it('rejects slots that already passed today', () => {
		const ctx = context({ date: TODAY })

		expect(canStartAt(toMinutes('09:00'), ctx)).toBe(false)
		expect(canStartAt(toMinutes('10:00'), ctx)).toBe(true)
	})

	it('rejects taken slots', () => {
		const ctx = context({ bookings: [booking()] })

		expect(canStartAt(toMinutes('12:00'), ctx)).toBe(false)
	})

	it('rejects a slot where 30 minutes do not fit', () => {
		const ctx = context({
			bookings: [booking({ start: '12:00', end: '13:00' })],
		})

		expect(canStartAt(toMinutes('11:45'), ctx)).toBe(false)
		expect(canStartAt(toMinutes('11:30'), ctx)).toBe(true)
	})

	it('rejects 17:45 — only 15 minutes are left in the day', () => {
		expect(canStartAt(toMinutes('17:45'), context())).toBe(false)
		expect(canStartAt(toMinutes('17:30'), context())).toBe(true)
	})
})

describe('buildStartOptions', () => {
	it('lists every possible start of the working day', () => {
		const options = buildStartOptions(context())

		expect(options).toHaveLength(36)
		expect(options[0]).toMatchObject({ value: '09:00', disabled: false })
	})

	it('disables taken and past slots', () => {
		const options = buildStartOptions(
			context({ date: TODAY, bookings: [booking({ date: TODAY })] })
		)
		const byValue = new Map(options.map((option) => [option.value, option]))

		expect(byValue.get('09:00')?.disabled).toBe(true)
		expect(byValue.get('12:00')?.disabled).toBe(true)
		expect(byValue.get('14:00')?.disabled).toBe(false)
	})
})

describe('buildEndOptions', () => {
	it('runs from the minimum duration up to the maximum', () => {
		const options = buildEndOptions('10:00', context())

		expect(options[0]).toMatchObject({ value: '10:30' })
		expect(options.at(-1)).toMatchObject({ value: '12:00' })
		expect(options).toHaveLength(7)
	})

	it('labels the duration', () => {
		const options = buildEndOptions('10:00', context())

		expect(options[0]?.label).toBe('10:30 · 30m')
		expect(options.at(-1)?.label).toBe('12:00 · 2h')
	})

	it('never offers to run into the next booking', () => {
		const ctx = context({
			bookings: [booking({ start: '11:00', end: '12:00' })],
		})

		expect(buildEndOptions('10:00', ctx).at(-1)).toMatchObject({
			value: '11:00',
		})
	})

	it('returns an empty list when 30 minutes do not fit', () => {
		const ctx = context({
			bookings: [booking({ start: '12:00', end: '13:00' })],
		})

		expect(buildEndOptions('11:45', ctx)).toEqual([])
	})
})

describe('firstAvailableStart / defaultEndFor', () => {
	it('finds the first free slot of a future day', () => {
		expect(firstAvailableStart(context())).toBe('09:00')
	})

	it('skips past and taken slots', () => {
		const ctx = context({
			date: TODAY,
			bookings: [booking({ date: TODAY, start: '10:00', end: '11:00' })],
		})

		expect(firstAvailableStart(ctx)).toBe('11:00')
	})

	it('returns undefined when no slot is free', () => {
		const ctx = context({
			date: TODAY,
			now: { date: TODAY, minutes: 18 * 60 },
		})

		expect(firstAvailableStart(ctx)).toBeUndefined()
	})

	it('defaults to 30 minutes', () => {
		expect(defaultEndFor('10:00', context())).toBe('10:30')
	})

	it('trims the end down to the nearest booking', () => {
		const ctx = context({
			bookings: [booking({ start: '10:15', end: '11:00' })],
		})

		expect(defaultEndFor('10:00', ctx)).toBe('10:15')
	})
})
