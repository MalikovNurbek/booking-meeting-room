import type { Violation, ViolationField } from '#shared/domain/booking-rules'
import type { ApiErrorBody, ApiErrorCode } from '#shared/types/api'
import type { Booking } from '#shared/types/booking'

const FALLBACK_MESSAGES: Record<number, string> = {
	0: 'No connection to the server. Check your network and try again.',
	404: 'Booking not found — it may have already been deleted.',
	409: 'That slot has just been taken. The list is refreshed — pick another time.',
	500: 'The server could not process the request. Please try again.',
}

export class BookingApiError extends Error {
	readonly status: number
	readonly code: ApiErrorCode
	readonly violations: Violation[]
	readonly fields: Record<string, string[]>

	constructor(status: number, body?: Partial<ApiErrorBody>) {
		const message =
			body?.message ??
			FALLBACK_MESSAGES[status] ??
			'Unexpected error. Please try again.'

		super(message)

		this.name = 'BookingApiError'
		this.status = status
		this.code = body?.code ?? 'UNKNOWN'
		this.violations = body?.violations ?? []
		this.fields = body?.fields ?? {}
	}

	get isConflict(): boolean {
		return this.status === 409
	}

	get isNotFound(): boolean {
		return this.status === 404
	}

	get conflicts(): Booking[] {
		return this.violations.flatMap((violation) => violation.conflicts ?? [])
	}

	get fieldMessages(): Partial<Record<ViolationField, string>> {
		const fromViolations = this.violations.reduce<
			Partial<Record<ViolationField, string>>
		>((accumulator, violation) => {
			if (violation.field && !accumulator[violation.field]) {
				accumulator[violation.field] = violation.message
			}

			return accumulator
		}, {})

		for (const [field, messages] of Object.entries(this.fields)) {
			const key = field as ViolationField

			if (!fromViolations[key] && messages[0]) {
				fromViolations[key] = messages[0]
			}
		}

		return fromViolations
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function extractBody(payload: unknown): Partial<ApiErrorBody> | undefined {
	if (!isRecord(payload)) {
		return undefined
	}

	if (isRecord(payload.data) && typeof payload.data.code === 'string') {
		return payload.data as Partial<ApiErrorBody>
	}

	if (typeof payload.code === 'string') {
		return payload as Partial<ApiErrorBody>
	}

	return undefined
}

export function toApiError(error: unknown): BookingApiError {
	if (error instanceof BookingApiError) {
		return error
	}

	if (!isRecord(error)) {
		return new BookingApiError(0)
	}

	const status = Number(error.status ?? error.statusCode ?? 0)
	const body = extractBody(error.data)

	if (body) {
		return new BookingApiError(status, body)
	}

	return new BookingApiError(Number.isFinite(status) ? status : 0)
}
