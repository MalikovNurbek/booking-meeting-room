import { primaryViolation } from '#shared/domain/booking-rules'
import type { Violation } from '#shared/domain/booking-rules'
import type { ApiErrorBody } from '#shared/types/api'
import { createError } from 'h3'
import type * as v from 'valibot'

type SchemaIssues = [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]

const FIELD_LABELS: Record<string, string> = {
	date: 'date',
	start: 'start time',
	end: 'end time',
	title: 'title',
}

export function httpError(statusCode: number, body: ApiErrorBody) {
	return createError({
		statusCode,
		statusMessage: body.code,
		message: body.message,
		data: body,
	})
}

export function notFoundError() {
	return httpError(404, {
		code: 'NOT_FOUND',
		message: 'Booking not found — it may have already been deleted.',
	})
}

function messageOf(issue: v.BaseIssue<unknown>): string {
	if (issue.type === 'object' && issue.received === 'undefined') {
		const key = String(issue.path?.[0]?.key ?? '')

		return `Missing required field: ${FIELD_LABELS[key] ?? key}.`
	}

	return issue.message
}

/** Schema parsing error: the client gets messages grouped by field. */
export function schemaError(issues: SchemaIssues) {
	const fields: Record<string, string[]> = {}
	let rootMessage: string | undefined

	for (const issue of issues) {
		const key = issue.path?.[0]?.key
		const message = messageOf(issue)

		if (typeof key === 'string') {
			fields[key] = [...(fields[key] ?? []), message]
		} else {
			rootMessage ??= message
		}
	}

	const firstFieldMessage = Object.values(fields)[0]?.[0]

	return httpError(422, {
		code: 'BAD_REQUEST',
		message: rootMessage ?? firstFieldMessage ?? 'Invalid request body.',
		fields: Object.keys(fields).length > 0 ? fields : undefined,
	})
}

/**
 * A business rule violation. An overlap between bookings is 409
 * (rule 8 of the brief); everything else is 422.
 */
export function violationError(violations: Violation[]) {
	const primary = primaryViolation(violations)

	if (!primary) {
		return httpError(422, {
			code: 'UNKNOWN',
			message: 'Could not save the booking.',
		})
	}

	return httpError(primary.code === 'OVERLAP' ? 409 : 422, {
		code: primary.code,
		message: primary.message,
		violations,
	})
}
