import type { Violation } from '#shared/domain/booking-rules'

export type ApiErrorCode =
	| Violation['code']
	| 'BAD_REQUEST'
	| 'NOT_FOUND'
	| 'UNKNOWN'

export interface ApiErrorBody {
	code: ApiErrorCode
	message: string
	violations?: Violation[]
	fields?: Record<string, string[]>
}
