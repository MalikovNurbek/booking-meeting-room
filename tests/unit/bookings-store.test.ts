import { bookingsStore } from '~~/server/utils/bookingsStore'
import type { Booking } from '#shared/types/booking'
import { beforeEach, describe, expect, it } from 'vitest'

const FIXTURE: Booking[] = [
	{ id: 'a', date: '2026-10-10', start: '14:00', end: '15:00', title: 'B' },
	{ id: 'b', date: '2026-10-10', start: '09:00', end: '09:30', title: 'A' },
	{ id: 'c', date: '2026-10-11', start: '10:00', end: '11:00' },
]

beforeEach(() => {
	bookingsStore.reset(FIXTURE)
})

describe('bookingsStore', () => {
	it('returns the day bookings sorted by start time', () => {
		expect(bookingsStore.byDate('2026-10-10').map((item) => item.id)).toEqual([
			'b',
			'a',
		])
	})

	it('returns an empty array for a date with no bookings', () => {
		expect(bookingsStore.byDate('2026-12-31')).toEqual([])
	})

	it('creates a booking with a unique id', () => {
		const created = bookingsStore.create({
			date: '2026-10-12',
			start: '10:00',
			end: '11:00',
			title: 'New one',
		})

		expect(created.id).toBeTruthy()
		expect(bookingsStore.get(created.id)).toEqual(created)
		expect(bookingsStore.all()).toHaveLength(FIXTURE.length + 1)
	})

	it('turns a blank title into an absent field', () => {
		const created = bookingsStore.create({
			date: '2026-10-12',
			start: '10:00',
			end: '11:00',
			title: '   ',
		})

		expect(created.title).toBeUndefined()
	})

	it('updates only the fields that were sent', () => {
		const updated = bookingsStore.update('a', { end: '15:30' })

		expect(updated).toMatchObject({
			id: 'a',
			start: '14:00',
			end: '15:30',
			title: 'B',
		})
	})

	it('clears the title with an empty string', () => {
		expect(bookingsStore.update('a', { title: '' })?.title).toBeUndefined()
	})

	it('returns undefined when updating a missing booking', () => {
		expect(bookingsStore.update('missing', { end: '12:00' })).toBeUndefined()
	})

	it('deletes a booking', () => {
		expect(bookingsStore.remove('a')).toBe(true)
		expect(bookingsStore.get('a')).toBeUndefined()
		expect(bookingsStore.remove('a')).toBe(false)
	})

	it('resets to the given set', () => {
		bookingsStore.create({ date: '2026-10-12', start: '10:00', end: '11:00' })
		bookingsStore.reset(FIXTURE)

		expect(bookingsStore.all()).toHaveLength(FIXTURE.length)
	})

	it('resets to the seed data when called without arguments', () => {
		bookingsStore.reset()

		expect(bookingsStore.all().length).toBeGreaterThan(0)
	})
})
