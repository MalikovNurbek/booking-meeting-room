import { describe, expect, it } from 'vitest'
import { toBookingDraft } from '~/utils/bookingDraft'

describe('toBookingDraft', () => {
	const base = { date: '2026-10-10', start: '10:00', end: '11:00' }

	it('carries the form fields through', () => {
		expect(toBookingDraft({ ...base, title: 'Interview' })).toEqual({
			...base,
			title: 'Interview',
		})
	})

	it('trims the title', () => {
		expect(toBookingDraft({ ...base, title: '  Interview  ' }).title).toBe(
			'Interview'
		)
	})

	it('keeps an empty title in the payload so PATCH can clear it', () => {
		// An absent key means "leave unchanged" on PATCH, so a blank title has
		// to be sent explicitly — otherwise it could never be removed.
		const draft = toBookingDraft({ ...base, title: '' })

		expect('title' in draft).toBe(true)
		expect(draft.title).toBe('')
	})

	it('turns a whitespace-only title into an empty one', () => {
		expect(toBookingDraft({ ...base, title: '   ' }).title).toBe('')
	})

	it('sends an empty title when the field was never filled', () => {
		const draft = toBookingDraft(base)

		expect('title' in draft).toBe(true)
		expect(draft.title).toBe('')
	})

	it('falls back to empty strings for missing fields', () => {
		expect(toBookingDraft({})).toEqual({
			date: '',
			start: '',
			end: '',
			title: '',
		})
	})
})
