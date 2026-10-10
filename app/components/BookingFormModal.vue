<script setup lang="ts">
import { validateBooking } from '#shared/domain/booking-rules'
import type { NowContext } from '#shared/domain/clock'
import { MAX_TITLE_LENGTH, toMinutes } from '#shared/domain/time'
import { bookingFormSchema } from '#shared/schemas/booking'
import type { BookingFormState } from '#shared/schemas/booking'
import type { Booking, BookingDraft } from '#shared/types/booking'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { BookingApiError } from '~/utils/apiError'
import { toBookingDraft } from '~/utils/bookingDraft'
import {
	buildEndOptions,
	buildStartOptions,
	defaultEndFor,
	firstAvailableStart,
} from '~/utils/bookingSlots'
import type { SlotContext } from '~/utils/bookingSlots'
import { formatDateLabel, formatRange } from '~/utils/format'

const props = defineProps<{
	open: boolean
	booking: Booking | null
	date: string
	prefillStart: string | null
	bookings: Booking[]
	now: NowContext
	saving: boolean
	serverError: BookingApiError | null
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	submit: [draft: BookingDraft]
}>()

const form = ref<{ setErrors: (errors: FormError[]) => void } | null>(null)

const state = reactive<BookingFormState>({
	date: props.date,
	start: '09:00',
	end: '09:30',
	title: '',
})

const isEditing = computed(() => props.booking !== null)

const slotContext = computed<SlotContext>(() => ({
	date: state.date,
	bookings: props.bookings,
	now: props.now,
	ignoreId: props.booking?.id,
}))

const startOptions = computed(() => buildStartOptions(slotContext.value))
const endOptions = computed(() =>
	buildEndOptions(state.start, slotContext.value)
)

const hasFreeSlots = computed(() =>
	startOptions.value.some((option) => !option.disabled)
)

function resetState(): void {
	if (props.booking) {
		Object.assign(state, {
			date: props.booking.date,
			start: props.booking.start,
			end: props.booking.end,
			title: props.booking.title ?? '',
		})

		return
	}

	const context: SlotContext = {
		date: props.date,
		bookings: props.bookings,
		now: props.now,
	}
	const start = props.prefillStart ?? firstAvailableStart(context) ?? '09:00'

	Object.assign(state, {
		date: props.date,
		start,
		end: defaultEndFor(start, context),
		title: '',
	})
}

watch(
	() => props.open,
	(open) => {
		if (open) {
			resetState()
		}
	},
	{ immediate: true }
)

watch(
	() => [state.start, state.date] as const,
	() => {
		const options = endOptions.value

		if (options.length === 0) {
			return
		}

		if (!options.some((option) => option.value === state.end)) {
			state.end = options[0]!.value
		}
	}
)

watch(
	() => props.serverError,
	(error) => {
		if (!error) {
			return
		}

		const errors = Object.entries(error.fieldMessages).map(
			([name, message]) => ({
				name,
				message: error.isConflict ? 'This slot is already taken' : message,
			})
		)

		if (errors.length > 0) {
			form.value?.setErrors(errors)
		}
	}
)

function validate(data: Partial<BookingFormState>): FormError[] {
	return validateBooking(toBookingDraft(data), {
		bookings: props.bookings,
		now: props.now,
		ignoreId: props.booking?.id,
		original: props.booking ?? undefined,
	}).map((violation) => ({
		name: violation.field ?? 'start',
		message: violation.message,
	}))
}

function onSubmit(event: FormSubmitEvent<BookingFormState>): void {
	emit('submit', toBookingDraft(event.data))
}

const endHint = computed(() => {
	if (endOptions.value.length === 0) {
		return 'No free time left after this start — choose a different start.'
	}

	const minutes = toMinutes(state.end) - toMinutes(state.start)

	return minutes > 0 ? formatRange(state.start, state.end) : ''
})
</script>

<template>
	<UModal
		:open="open"
		:title="isEditing ? 'Edit booking' : 'New booking'"
		:description="formatDateLabel(state.date)"
		:dismissible="!saving"
		@update:open="emit('update:open', $event)"
	>
		<template #body>
			<UForm
				id="booking-form"
				ref="form"
				:schema="bookingFormSchema"
				:state="state"
				:validate="validate"
				class="space-y-4"
				data-qa-selector="booking_form"
				@submit="onSubmit"
			>
				<UAlert
					v-if="serverError"
					color="error"
					variant="subtle"
					icon="i-lucide-triangle-alert"
					:title="
						serverError.isConflict
							? 'That slot has just been taken'
							: 'Could not save'
					"
					:description="serverError.message"
					data-qa-selector="booking_form_error"
				/>

				<UAlert
					v-else-if="!hasFreeSlots"
					color="warning"
					variant="subtle"
					icon="i-lucide-info"
					title="No free slots on this date"
					description="Pick another date, or free up an existing booking."
				/>

				<UFormField label="Date" name="date" required>
					<UInput
						v-model="state.date"
						type="date"
						class="w-full"
						data-qa-selector="booking_form_date"
					/>
				</UFormField>

				<div class="grid gap-4 sm:grid-cols-2">
					<UFormField label="Start" name="start" required>
						<USelect
							v-model="state.start"
							:items="startOptions"
							class="w-full"
							data-qa-selector="booking_form_start"
						/>
					</UFormField>

					<UFormField label="End" name="end" required :help="endHint">
						<USelect
							v-model="state.end"
							:items="endOptions"
							:disabled="endOptions.length === 0"
							placeholder="No time available"
							class="w-full"
							data-qa-selector="booking_form_end"
						/>
					</UFormField>
				</div>

				<UFormField
					label="Title"
					name="title"
					:help="`Optional, up to ${MAX_TITLE_LENGTH} characters`"
				>
					<UInput
						v-model="state.title"
						placeholder="For example, candidate interview"
						:maxlength="MAX_TITLE_LENGTH"
						class="w-full"
						data-qa-selector="booking_form_title"
					/>
				</UFormField>
			</UForm>
		</template>

		<template #footer>
			<div class="flex w-full justify-end gap-2">
				<UButton
					color="neutral"
					variant="ghost"
					:disabled="saving"
					data-qa-selector="booking_form_cancel"
					@click="emit('update:open', false)"
				>
					Cancel
				</UButton>
				<UButton
					type="submit"
					form="booking-form"
					:loading="saving"
					:disabled="endOptions.length === 0"
					data-qa-selector="booking_form_submit"
				>
					{{ isEditing ? 'Save' : 'Book' }}
				</UButton>
			</div>
		</template>
	</UModal>
</template>
