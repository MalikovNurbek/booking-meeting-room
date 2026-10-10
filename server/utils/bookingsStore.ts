import { nowContext } from '#shared/domain/clock'
import { shiftDateString } from '#shared/domain/time'
import type { Booking, BookingDraft, BookingPatch } from '#shared/types/booking'

const bookings = new Map<string, Booking>()

function normalizeTitle(title: string | undefined): string | undefined {
	const trimmed = title?.trim()

	return trimmed ? trimmed : undefined
}

function buildSeed(): Booking[] {
	const today = nowContext().date
	const tomorrow = shiftDateString(today, 1)

	return [
		{
			id: 'seed-1',
			date: today,
			start: '09:00',
			end: '09:30',
			title: 'Standup',
		},
		{
			id: 'seed-2',
			date: today,
			start: '15:00',
			end: '16:30',
			title: 'Client demo',
		},
		{ id: 'seed-3', date: tomorrow, start: '11:00', end: '12:00' },
		{
			id: 'seed-4',
			date: tomorrow,
			start: '14:00',
			end: '15:00',
			title: 'Retro',
		},
	]
}

function ensureSeeded(): void {
	if (bookings.size === 0) {
		for (const booking of buildSeed()) {
			bookings.set(booking.id, booking)
		}
	}
}

ensureSeeded()

export const bookingsStore = {
	all(): Booking[] {
		return [...bookings.values()]
	},

	byDate(date: string): Booking[] {
		return this.all()
			.filter((booking) => booking.date === date)
			.sort((a, b) => a.start.localeCompare(b.start))
	},

	get(id: string): Booking | undefined {
		return bookings.get(id)
	},

	create(draft: BookingDraft): Booking {
		const booking: Booking = {
			id: globalThis.crypto.randomUUID(),
			date: draft.date,
			start: draft.start,
			end: draft.end,
			title: normalizeTitle(draft.title),
		}

		bookings.set(booking.id, booking)

		return booking
	},

	update(id: string, patch: BookingPatch): Booking | undefined {
		const existing = bookings.get(id)

		if (!existing) {
			return undefined
		}

		const updated: Booking = {
			...existing,
			...patch,
			title: 'title' in patch ? normalizeTitle(patch.title) : existing.title,
		}

		bookings.set(id, updated)

		return updated
	},

	remove(id: string): boolean {
		return bookings.delete(id)
	},

	insert(booking: Booking): Booking {
		bookings.set(booking.id, booking)

		return booking
	},

	reset(items?: Booking[]): void {
		bookings.clear()

		for (const booking of items ?? buildSeed()) {
			bookings.set(booking.id, booking)
		}
	},
}
