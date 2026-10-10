import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { notFoundError } from '../../utils/apiError'
import { bookingsStore } from '../../utils/bookingsStore'
import { simulateLatency } from '../../utils/latency'

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')

	if (!id || !bookingsStore.get(id)) {
		throw notFoundError()
	}

	await simulateLatency()

	bookingsStore.remove(id)

	setResponseStatus(event, 204)

	return null
})
