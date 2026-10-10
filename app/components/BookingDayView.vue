<script setup lang="ts">
import { nowContext } from '#shared/domain/clock'
import {
	WORK_DAY_END_MINUTES,
	WORK_DAY_START_MINUTES,
	compareDateStrings,
	isDateString,
	shiftDateString,
	toMinutes,
	toTimeString,
} from '#shared/domain/time'
import type { Booking, BookingDraft } from '#shared/types/booking'
import { useBookings } from '~/composables/useBookings'
import { useNowContext } from '~/composables/useNowContext'
import type { BookingApiError } from '~/utils/apiError'
import { formatDateLabel, formatDuration, formatRange } from '~/utils/format'

const now = useNowContext()

const dateInput = ref(nowContext().date)
const selectedDate = ref(dateInput.value)

watch(dateInput, (value) => {
	if (isDateString(value)) {
		selectedDate.value = value
	}
})

function setDate(date: string): void {
	selectedDate.value = date
	dateInput.value = date
}

function restoreDateInput(): void {
	if (!isDateString(dateInput.value)) {
		dateInput.value = selectedDate.value
	}
}

const {
	bookings,
	isLoading,
	isFetching,
	loadError,
	refresh,
	isSaving,
	isRemoving,
	create,
	update,
	remove,
} = useBookings(selectedDate)

const toast = useToast()

const isFormOpen = ref(false)
const editingBooking = ref<Booking | null>(null)
const prefillStart = ref<string | null>(null)
const formError = ref<BookingApiError | null>(null)

const bookingToDelete = ref<Booking | null>(null)
const deleteError = ref<BookingApiError | null>(null)

const isToday = computed(() => selectedDate.value === now.value.date)
const isPastDate = computed(
	() => compareDateStrings(selectedDate.value, now.value.date) < 0
)

const hasTimeLeft = computed(
	() => !isToday.value || now.value.minutes < WORK_DAY_END_MINUTES
)
const canCreate = computed(() => !isPastDate.value && hasTimeLeft.value)

const bookedMinutes = computed(() =>
	bookings.value.reduce(
		(total, booking) =>
			total + (toMinutes(booking.end) - toMinutes(booking.start)),
		0
	)
)

const summary = computed(() => {
	const count = bookings.value.length

	if (count === 0) {
		return 'Free all day'
	}

	return `${count} ${count === 1 ? 'booking' : 'bookings'} · ${formatDuration(bookedMinutes.value)} booked`
})

function shiftDay(days: number): void {
	setDate(shiftDateString(selectedDate.value, days))
}

function goToday(): void {
	setDate(now.value.date)
}

function openCreate(start?: string): void {
	editingBooking.value = null
	prefillStart.value = start ?? null
	formError.value = null
	isFormOpen.value = true
}

function openEdit(booking: Booking): void {
	editingBooking.value = booking
	prefillStart.value = null
	formError.value = null
	isFormOpen.value = true
}

async function submitBooking(draft: BookingDraft): Promise<void> {
	formError.value = null

	const editing = editingBooking.value
	const result = editing ? await update(editing.id, draft) : await create(draft)

	if (!result.ok) {
		formError.value = result.error

		return
	}

	isFormOpen.value = false
	toast.add({
		title: editing ? 'Booking updated' : 'Booking created',
		description: `${formatDateLabel(result.data.date)}, ${formatRange(result.data.start, result.data.end)}`,
		color: 'success',
		icon: 'i-lucide-check',
	})

	if (result.data.date !== selectedDate.value) {
		setDate(result.data.date)
	}
}

function askDelete(booking: Booking): void {
	bookingToDelete.value = booking
	deleteError.value = null
}

async function confirmDelete(): Promise<void> {
	const booking = bookingToDelete.value

	if (!booking) {
		return
	}

	deleteError.value = null

	const result = await remove(booking.id)

	if (result.ok) {
		bookingToDelete.value = null
		toast.add({
			title: 'Booking deleted',
			color: 'success',
			icon: 'i-lucide-check',
		})

		return
	}

	if (result.error.isNotFound) {
		bookingToDelete.value = null
		toast.add({
			title: 'This booking was already deleted',
			color: 'warning',
			icon: 'i-lucide-info',
		})

		return
	}

	deleteError.value = result.error
}

const workDayLabel = `${toTimeString(WORK_DAY_START_MINUTES)}–${toTimeString(WORK_DAY_END_MINUTES)}`
</script>

<template>
	<div class="space-y-4">
		<UCard>
			<div class="flex flex-col gap-4">
				<div
					class="border-default flex flex-wrap items-center justify-between gap-3 border-b pb-4"
				>
					<div class="flex items-center gap-1">
						<UButton
							icon="i-lucide-chevron-left"
							color="neutral"
							variant="ghost"
							aria-label="Previous day"
							data-qa-selector="date_prev"
							@click="shiftDay(-1)"
						/>
						<UInput
							v-model="dateInput"
							type="date"
							class="w-40"
							aria-label="Booking date"
							data-qa-selector="date_input"
							@blur="restoreDateInput"
						/>
						<UButton
							icon="i-lucide-chevron-right"
							color="neutral"
							variant="ghost"
							aria-label="Next day"
							data-qa-selector="date_next"
							@click="shiftDay(1)"
						/>
						<UButton
							v-if="!isToday"
							color="neutral"
							variant="subtle"
							size="sm"
							class="ml-1"
							data-qa-selector="date_today"
							@click="goToday"
						>
							Today
						</UButton>
					</div>

					<UButton
						icon="i-lucide-plus"
						:disabled="!canCreate"
						data-qa-selector="create_booking"
						@click="openCreate()"
					>
						Book a slot
					</UButton>
				</div>

				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<div>
						<h2
							class="text-highlighted text-lg font-semibold"
							data-qa-selector="selected_date_label"
						>
							{{ formatDateLabel(selectedDate) }}
						</h2>
						<p class="text-muted text-sm" data-qa-selector="day_summary">
							{{ summary }}
						</p>
					</div>

					<div class="text-muted flex items-center gap-2 text-sm">
						<UIcon
							v-if="isFetching && !isLoading"
							name="i-lucide-loader-circle"
							class="size-4 animate-spin"
						/>
						<span>Working day {{ workDayLabel }}</span>
					</div>
				</div>

				<UAlert
					v-if="isPastDate"
					color="neutral"
					variant="subtle"
					icon="i-lucide-history"
					title="Past date"
					description="New bookings are unavailable, but existing ones can be viewed and deleted."
					data-qa-selector="past_date_notice"
				/>
				<UAlert
					v-else-if="!hasTimeLeft"
					color="neutral"
					variant="subtle"
					icon="i-lucide-moon"
					title="The working day is over"
					description="Pick another date to book the meeting room."
				/>
			</div>
		</UCard>

		<UCard>
			<div
				v-if="isLoading"
				class="space-y-1"
				data-qa-selector="timeline_loading"
			>
				<USkeleton v-for="row in 12" :key="row" class="h-6 w-full" />
				<p class="sr-only">Loading bookings…</p>
			</div>

			<UAlert
				v-else-if="loadError"
				color="error"
				variant="subtle"
				icon="i-lucide-wifi-off"
				title="Could not load bookings"
				:description="loadError.message"
				:actions="[
					{
						label: 'Retry',
						color: 'error',
						variant: 'solid',
						onClick: () => {
							refresh()
						},
					},
				]"
				data-qa-selector="timeline_error"
			/>

			<div v-else class="space-y-3">
				<p
					v-if="bookings.length === 0"
					class="bg-elevated text-muted rounded-md px-3 py-2 text-sm"
					data-qa-selector="timeline_empty"
				>
					{{
						canCreate
							? 'No bookings yet — pick a free slot on the timeline.'
							: 'No bookings on this date.'
					}}
				</p>

				<BookingDayTimeline
					:bookings="bookings"
					:date="selectedDate"
					:now="now"
					:busy="isSaving || isRemoving"
					@create="openCreate"
					@edit="openEdit"
					@remove="askDelete"
				/>
			</div>
		</UCard>

		<BookingFormModal
			v-model:open="isFormOpen"
			:booking="editingBooking"
			:date="selectedDate"
			:prefill-start="prefillStart"
			:bookings="bookings"
			:now="now"
			:saving="isSaving"
			:server-error="formError"
			@submit="submitBooking"
		/>

		<UModal
			:open="bookingToDelete !== null"
			title="Delete this booking?"
			:description="
				bookingToDelete
					? `${formatDateLabel(bookingToDelete.date)}, ${formatRange(bookingToDelete.start, bookingToDelete.end)}`
					: undefined
			"
			:dismissible="!isRemoving"
			@update:open="bookingToDelete = null"
		>
			<template #body>
				<p class="text-muted text-sm">
					This cannot be undone. The slot will become free again.
				</p>
				<UAlert
					v-if="deleteError"
					color="error"
					variant="subtle"
					icon="i-lucide-triangle-alert"
					class="mt-3"
					:description="deleteError.message"
					data-qa-selector="delete_error"
				/>
			</template>

			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="isRemoving"
						@click="bookingToDelete = null"
					>
						Cancel
					</UButton>
					<UButton
						color="error"
						:loading="isRemoving"
						data-qa-selector="delete_confirm"
						@click="confirmDelete"
					>
						Delete
					</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>
