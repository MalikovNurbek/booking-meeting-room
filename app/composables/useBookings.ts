import type { Booking, BookingDraft, BookingPatch } from '#shared/types/booking'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { bookingsApi } from '~/api/bookingsApi'
import type { BookingApiError } from '~/utils/apiError'
import { toApiError } from '~/utils/apiError'

export const BOOKINGS_QUERY_KEY = 'bookings'

export type OperationResult<T = void> =
	| { ok: true; data: T }
	| { ok: false; error: BookingApiError }

interface UpdatePayload {
	id: string
	patch: BookingPatch
}

export function useBookings(date: Ref<string>) {
	const queryClient = useQueryClient()

	const query = useQuery({
		queryKey: computed(() => [BOOKINGS_QUERY_KEY, date.value]),
		queryFn: ({ signal }) => bookingsApi.list(date.value, signal),
	})

	function invalidate() {
		return queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] })
	}

	async function refreshOnStaleData(error: BookingApiError) {
		if (error.isConflict || error.isNotFound) {
			await invalidate()
		}
	}

	const createMutation = useMutation<Booking, BookingApiError, BookingDraft>({
		mutationFn: (draft) => bookingsApi.create(draft),
		onSuccess: invalidate,
		onError: refreshOnStaleData,
	})

	const updateMutation = useMutation<Booking, BookingApiError, UpdatePayload>({
		mutationFn: ({ id, patch }) => bookingsApi.update(id, patch),
		onSuccess: invalidate,
		onError: refreshOnStaleData,
	})

	const removeMutation = useMutation<string, BookingApiError, string>({
		mutationFn: async (id) => {
			await bookingsApi.remove(id)

			return id
		},
		onSuccess: invalidate,
		onError: refreshOnStaleData,
	})

	async function run<T>(
		operation: () => Promise<T>
	): Promise<OperationResult<T>> {
		try {
			return { ok: true, data: await operation() }
		} catch (error) {
			return { ok: false, error: toApiError(error) }
		}
	}

	return {
		bookings: computed(() => query.data.value ?? []),
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		isError: query.isError,
		loadError: computed(() =>
			query.error.value ? toApiError(query.error.value) : null
		),
		refresh: () => query.refetch(),

		isSaving: computed(
			() => createMutation.isPending.value || updateMutation.isPending.value
		),
		isRemoving: removeMutation.isPending,

		create(draft: BookingDraft) {
			return run(() => createMutation.mutateAsync(draft))
		},

		update(id: string, patch: BookingPatch) {
			return run(() => updateMutation.mutateAsync({ id, patch }))
		},

		remove(id: string) {
			return run(() => removeMutation.mutateAsync(id))
		},
	}
}
