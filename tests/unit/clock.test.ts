import { BUSINESS_TIME_ZONE, nowContext } from '#shared/domain/clock'
import { describe, expect, it } from 'vitest'

describe('nowContext', () => {
	it('converts to the business time zone, not the local one', () => {
		// 2026-10-10T20:30Z is already 11 October, 02:30 in Asia/Bishkek (UTC+6).
		const context = nowContext(new Date('2026-10-10T20:30:00Z'))

		expect(context).toEqual({ date: '2026-10-11', minutes: 2 * 60 + 30 })
	})

	it('handles midnight in the business time zone', () => {
		const context = nowContext(new Date('2026-10-10T18:00:00Z'))

		expect(context).toEqual({ date: '2026-10-11', minutes: 0 })
	})

	it('counts minutes since midnight during the working day', () => {
		const context = nowContext(new Date('2026-10-10T04:45:00Z'))

		expect(context).toEqual({ date: '2026-10-10', minutes: 10 * 60 + 45 })
	})

	it('honours an explicitly passed time zone', () => {
		const at = new Date('2026-10-10T23:30:00Z')

		expect(nowContext(at, 'UTC')).toEqual({
			date: '2026-10-10',
			minutes: 23 * 60 + 30,
		})
		expect(nowContext(at, BUSINESS_TIME_ZONE).date).toBe('2026-10-11')
	})
})
