const DEFAULT_LATENCY_MS = 250

export function simulateLatency(): Promise<void> {
	const configured = Number(process.env.MOCK_LATENCY_MS ?? DEFAULT_LATENCY_MS)
	const base = Number.isFinite(configured) ? configured : DEFAULT_LATENCY_MS

	if (base <= 0) {
		return Promise.resolve()
	}

	const jitter = Math.round(Math.random() * base * 0.4)

	return new Promise((resolve) => setTimeout(resolve, base + jitter))
}
