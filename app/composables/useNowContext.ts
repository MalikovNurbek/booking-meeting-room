import { nowContext } from '#shared/domain/clock'
import type { NowContext } from '#shared/domain/clock'
import { useNow } from '@vueuse/core'
import type { ComputedRef } from 'vue'

export function useNowContext(intervalMs = 30_000): ComputedRef<NowContext> {
	const now = useNow({ interval: intervalMs })

	return computed(() => nowContext(now.value))
}
