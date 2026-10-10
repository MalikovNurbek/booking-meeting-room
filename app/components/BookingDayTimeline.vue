<script setup lang="ts">
import type { NowContext } from '#shared/domain/clock'
import {
	UNTITLED_BOOKING_LABEL,
	WORK_DAY_END_MINUTES,
	WORK_DAY_START_MINUTES,
	toMinutes,
} from '#shared/domain/time'
import type { Booking } from '#shared/types/booking'
import { formatDuration, formatRange } from '~/utils/format'
import {
	TIMELINE_ROW_COUNT,
	buildHourLabels,
	buildTimeline,
} from '~/utils/timeline'
import type { TimelineBooking, TimelineFreeSlot } from '~/utils/timeline'

const props = defineProps<{
	bookings: Booking[]
	date: string
	now: NowContext
	busy?: boolean
}>()

const emit = defineEmits<{
	create: [start: string]
	edit: [booking: Booking]
	remove: [booking: Booking]
}>()

const hourLabels = buildHourLabels()

const rowsStyle = {
	gridTemplateRows: `repeat(${TIMELINE_ROW_COUNT}, var(--slot-height))`,
}

const cells = computed(() =>
	buildTimeline(props.bookings, props.date, props.now)
)

const nowOffsetRows = computed(() => {
	if (props.date !== props.now.date) {
		return null
	}

	const { minutes } = props.now

	if (minutes < WORK_DAY_START_MINUTES || minutes > WORK_DAY_END_MINUTES) {
		return null
	}

	return (minutes - WORK_DAY_START_MINUTES) / 15
})

function titleOf(booking: Booking): string {
	return booking.title?.trim() || UNTITLED_BOOKING_LABEL
}

function durationOf(booking: Booking): string {
	return formatDuration(toMinutes(booking.end) - toMinutes(booking.start))
}

function slotLabel(cell: TimelineFreeSlot): string {
	if (cell.isPast) {
		return `${cell.start} — time has passed`
	}

	return cell.isBookable
		? `Book from ${cell.start}`
		: `${cell.start} — slot too short`
}

function blockClasses(cell: TimelineBooking): string[] {
	if (cell.isOngoing) {
		return ['border-primary/60', 'bg-primary/10']
	}

	return cell.isPast
		? ['border-default', 'bg-elevated/60', 'opacity-70']
		: ['border-default', 'bg-elevated']
}
</script>

<template>
	<div
		class="grid grid-cols-[3rem_1fr] gap-x-2 [--slot-height:1.5rem] sm:grid-cols-[3.5rem_1fr] sm:gap-x-4 sm:[--slot-height:1.75rem]"
		:class="busy ? 'pointer-events-none opacity-60' : undefined"
		data-qa-selector="timeline"
	>
		<div class="grid" :style="rowsStyle" aria-hidden="true">
			<div
				v-for="label in hourLabels"
				:key="label.time"
				class="border-default text-muted -mt-px border-t pt-0.5 text-right text-xs tabular-nums"
				:style="{ gridRow: `${label.row} / span ${label.span}` }"
			>
				{{ label.time }}
			</div>
		</div>

		<div class="relative">
			<ul
				class="grid"
				:style="rowsStyle"
				:aria-label="`Working day slots, ${date}`"
				data-qa-selector="timeline_slots"
			>
				<li
					v-for="cell in cells"
					:key="cell.key"
					class="py-px"
					:style="{ gridRow: `${cell.row} / span ${cell.span}` }"
				>
					<button
						v-if="cell.kind === 'free'"
						type="button"
						class="group border-default enabled:hover:border-primary enabled:hover:bg-primary/10 disabled:bg-elevated/30 flex h-full w-full items-center gap-1.5 rounded-sm border border-dashed px-2 text-left text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:border-transparent"
						:disabled="!cell.isBookable"
						:aria-label="slotLabel(cell)"
						:data-qa-selector="`timeline_slot_${cell.start}`"
						@click="emit('create', cell.start)"
					>
						<span
							class="w-10 shrink-0"
							:class="
								cell.isLabelled && cell.isBookable
									? 'text-dimmed'
									: 'text-transparent'
							"
						>
							{{ cell.start }}
						</span>
						<UIcon
							name="i-lucide-plus"
							class="text-primary size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
						/>
					</button>

					<article
						v-else
						class="flex h-full items-start gap-2 overflow-hidden rounded-md border px-2 py-1"
						:class="blockClasses(cell)"
						:data-qa-selector="`timeline_booking_${cell.booking.start}`"
					>
						<div class="min-w-0 flex-1 leading-tight">
							<p class="text-highlighted truncate text-xs font-medium">
								{{ titleOf(cell.booking) }}
								<UBadge
									v-if="cell.isOngoing"
									color="primary"
									variant="subtle"
									size="sm"
									class="ml-1 align-middle"
								>
									now
								</UBadge>
							</p>
							<p class="text-muted truncate text-xs tabular-nums">
								{{ formatRange(cell.booking.start, cell.booking.end) }} ·
								{{ durationOf(cell.booking) }}
							</p>
						</div>

						<div class="flex shrink-0 items-center gap-0.5">
							<UButton
								v-if="!cell.isPast"
								icon="i-lucide-pencil"
								color="neutral"
								variant="ghost"
								size="xs"
								:aria-label="`Edit booking ${formatRange(cell.booking.start, cell.booking.end)}`"
								:data-qa-selector="`timeline_edit_${cell.booking.start}`"
								@click="emit('edit', cell.booking)"
							/>
							<UButton
								icon="i-lucide-trash-2"
								color="neutral"
								variant="ghost"
								size="xs"
								:aria-label="`Delete booking ${formatRange(cell.booking.start, cell.booking.end)}`"
								:data-qa-selector="`timeline_delete_${cell.booking.start}`"
								@click="emit('remove', cell.booking)"
							/>
						</div>
					</article>
				</li>
			</ul>

			<div
				v-if="nowOffsetRows !== null"
				class="pointer-events-none absolute inset-x-0 flex items-center"
				:style="{ top: `calc(var(--slot-height) * ${nowOffsetRows})` }"
				aria-hidden="true"
				data-qa-selector="timeline_now_line"
			>
				<span class="bg-error size-1.5 shrink-0 rounded-full" />
				<span class="bg-error/60 h-px flex-1" />
			</div>
		</div>
	</div>
</template>
