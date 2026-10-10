import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatDuration, formatRange } from '~/utils/format'

describe('formatDateLabel', () => {
	it('shows the weekday and the date', () => {
		expect(formatDateLabel('2026-10-10')).toBe('Saturday 10 October')
	})

	it('does not drift because of the time zone', () => {
		expect(formatDateLabel('2026-01-01')).toContain('1 January')
		expect(formatDateLabel('2026-12-31')).toContain('31 December')
	})
})

describe('formatDuration', () => {
	it.each([
		[15, '15m'],
		[30, '30m'],
		[60, '1h'],
		[90, '1h 30m'],
		[120, '2h'],
	])('%i minutes → %s', (minutes, expected) => {
		expect(formatDuration(minutes)).toBe(expected)
	})
})

describe('formatRange', () => {
	it('joins times with an en dash', () => {
		expect(formatRange('10:00', '11:00')).toBe('10:00–11:00')
	})
})
