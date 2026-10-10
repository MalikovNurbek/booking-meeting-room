import type { Booking } from '#shared/types/booking'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { BookingApiError } from '~/utils/apiError'

/**
 * The data composable is mocked out: these tests are about the UI states —
 * loading, error, an empty day and the summary.
 */
const state = {
	bookings: ref<Booking[]>([]),
	isLoading: ref(false),
	isFetching: ref(false),
	isError: ref(false),
	loadError: ref<BookingApiError | null>(null),
	isSaving: ref(false),
	isRemoving: ref(false),
	refresh: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
}

vi.mock('~/composables/useBookings', () => ({
	BOOKINGS_QUERY_KEY: 'bookings',
	useBookings: () => state,
}))

const BookingDayView = await import('~/components/BookingDayView.vue').then(
	(module) => module.default
)

beforeEach(() => {
	state.bookings.value = []
	state.isLoading.value = false
	state.isFetching.value = false
	state.loadError.value = null
	state.isSaving.value = false
	state.isRemoving.value = false
})

describe('BookingDayView', () => {
	it('shows a skeleton while loading', async () => {
		state.isLoading.value = true

		const component = await mountSuspended(BookingDayView)

		expect(
			component.find('[data-qa-selector="timeline_loading"]').exists()
		).toBe(true)
		expect(component.find('[data-qa-selector="timeline"]').exists()).toBe(false)
	})

	it('shows a load error instead of the grid', async () => {
		state.loadError.value = new BookingApiError(0)

		const component = await mountSuspended(BookingDayView)
		const alert = component.find('[data-qa-selector="timeline_error"]')

		expect(alert.exists()).toBe(true)
		expect(alert.text()).toContain('No connection to the server')
		expect(component.find('[data-qa-selector="timeline"]').exists()).toBe(false)
	})

	it('shows the empty state and the grid when there are no bookings', async () => {
		const component = await mountSuspended(BookingDayView)

		expect(component.find('[data-qa-selector="timeline_empty"]').exists()).toBe(
			true
		)
		expect(component.find('[data-qa-selector="timeline"]').exists()).toBe(true)
		expect(component.find('[data-qa-selector="day_summary"]').text()).toBe(
			'Free all day'
		)
	})

	it('summarises the day', async () => {
		const today = new Date().toISOString().slice(0, 10)

		state.bookings.value = [
			{ id: 'a', date: today, start: '10:00', end: '11:00' },
			{ id: 'b', date: today, start: '12:00', end: '12:30' },
		]

		const component = await mountSuspended(BookingDayView)

		expect(component.find('[data-qa-selector="day_summary"]').text()).toBe(
			'2 bookings · 1h 30m booked'
		)
		expect(component.find('[data-qa-selector="timeline_empty"]').exists()).toBe(
			false
		)
	})

	it('survives a cleared date field and keeps the day on screen', async () => {
		const component = await mountSuspended(BookingDayView)
		const label = component
			.find('[data-qa-selector="selected_date_label"]')
			.text()
		const input = component.find('[data-qa-selector="date_input"]')

		await input.setValue('')

		expect(
			component.find('[data-qa-selector="selected_date_label"]').text()
		).toBe(label)

		// Leaving the field empty restores the day currently shown.
		await input.trigger('blur')

		expect((input.element as HTMLInputElement).value).not.toBe('')
	})

	it('blocks creating on a past date and explains why', async () => {
		const component = await mountSuspended(BookingDayView)

		await component
			.find('[data-qa-selector="date_input"]')
			.setValue('2020-01-01')

		expect(
			component.find('[data-qa-selector="past_date_notice"]').exists()
		).toBe(true)
		expect(
			component
				.find('[data-qa-selector="create_booking"]')
				.attributes('disabled')
		).toBeDefined()
	})
})
