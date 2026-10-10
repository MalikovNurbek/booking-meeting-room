import {
	DATE_PATTERN,
	MAX_TITLE_LENGTH,
	TIME_PATTERN,
	isDateString,
} from '#shared/domain/time'
import * as v from 'valibot'

const dateField = v.pipe(
	v.string('Enter a date.'),
	v.regex(DATE_PATTERN, 'Enter a date in YYYY-MM-DD format.'),
	v.check((value: string) => isDateString(value), 'This date does not exist.')
)

const timeField = v.pipe(
	v.string('Enter a time.'),
	v.regex(TIME_PATTERN, 'Enter a time in HH:mm format.')
)

const titleField = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(MAX_TITLE_LENGTH, `At most ${MAX_TITLE_LENGTH} characters.`)
)

export const bookingDraftSchema = v.object({
	date: dateField,
	start: timeField,
	end: timeField,
	title: v.optional(titleField),
})

export const bookingPatchSchema = v.partial(bookingDraftSchema)

export const bookingQuerySchema = v.object({
	date: dateField,
})

/** Form state: same fields, but `title` is always a string for the input. */
export const bookingFormSchema = v.object({
	date: dateField,
	start: timeField,
	end: timeField,
	title: v.optional(titleField, ''),
})

export type BookingFormState = v.InferOutput<typeof bookingFormSchema>
