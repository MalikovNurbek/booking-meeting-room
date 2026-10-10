import type { NowContext } from '#shared/domain/clock'
import type { Booking } from '#shared/types/booking'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BookingDayTimeline from '~/components/BookingDayTimeline.vue'

const TODAY = '2026-10-10'
const TOMORROW = '2026-10-11'
const NOW: NowContext = { date: TODAY, minutes: 10 * 60 }

const booking: Booking = {
	id: 'b1',
	date: TOMORROW,
	start: '12:00',
	end: '13:00',
	title: 'Planning',
}

function mount(
	props: Partial<InstanceType<typeof BookingDayTimeline>['$props']> = {}
) {
	return mountSuspended(BookingDayTimeline, {
		props: { bookings: [], date: TOMORROW, now: NOW, ...props },
	})
}

describe('BookingDayTimeline', () => {
	it('renders 36 slots for an empty day', async () => {
		const component = await mount()

		expect(
			component.findAll('[data-qa-selector^="timeline_slot_"]')
		).toHaveLength(36)
	})

	it('shows a booking with its time', async () => {
		const component = await mount({ bookings: [booking] })
		const block = component.find('[data-qa-selector="timeline_booking_12:00"]')

		expect(block.exists()).toBe(true)
		expect(block.text()).toContain('Planning')
		expect(block.text()).toContain('12:00–13:00')
		expect(block.text()).toContain('1h')
	})

	it('labels a booking without a title', async () => {
		const component = await mount({
			bookings: [{ ...booking, title: undefined }],
		})

		expect(
			component.find('[data-qa-selector="timeline_booking_12:00"]').text()
		).toContain('Untitled')
	})

	it('disables slots that already passed today', async () => {
		const component = await mount({ date: TODAY })

		const past = component.find('[data-qa-selector="timeline_slot_09:00"]')
		const future = component.find('[data-qa-selector="timeline_slot_11:00"]')

		expect(past.attributes('disabled')).toBeDefined()
		expect(past.attributes('aria-label')).toContain('time has passed')
		expect(future.attributes('disabled')).toBeUndefined()
	})

	it('disables a slot the minimum duration does not fit into', async () => {
		const component = await mount({ bookings: [booking] })
		const slot = component.find('[data-qa-selector="timeline_slot_11:45"]')

		expect(slot.attributes('disabled')).toBeDefined()
		expect(slot.attributes('aria-label')).toContain('too short')
	})

	it('emits the slot the user picked', async () => {
		const component = await mount()

		await component
			.find('[data-qa-selector="timeline_slot_10:00"]')
			.trigger('click')

		expect(component.emitted('create')?.[0]).toEqual(['10:00'])
	})

	it('emits edit and delete requests', async () => {
		const component = await mount({ bookings: [booking] })

		await component
			.find('[data-qa-selector="timeline_edit_12:00"]')
			.trigger('click')
		await component
			.find('[data-qa-selector="timeline_delete_12:00"]')
			.trigger('click')

		expect(component.emitted('edit')?.[0]).toEqual([booking])
		expect(component.emitted('remove')?.[0]).toEqual([booking])
	})

	it('does not offer to edit a finished booking', async () => {
		const component = await mount({
			date: TODAY,
			bookings: [{ ...booking, date: TODAY, start: '09:00', end: '09:30' }],
		})

		expect(
			component.find('[data-qa-selector="timeline_edit_09:00"]').exists()
		).toBe(false)
		expect(
			component.find('[data-qa-selector="timeline_delete_09:00"]').exists()
		).toBe(true)
	})

	it('shows the current-time line only for today', async () => {
		const today = await mount({ date: TODAY })
		const tomorrow = await mount({ date: TOMORROW })

		expect(today.find('[data-qa-selector="timeline_now_line"]').exists()).toBe(
			true
		)
		expect(
			tomorrow.find('[data-qa-selector="timeline_now_line"]').exists()
		).toBe(false)
	})

	it('dims the grid while saving', async () => {
		const component = await mount({ busy: true })

		expect(component.find('[data-qa-selector="timeline"]').classes()).toContain(
			'pointer-events-none'
		)
	})
})
