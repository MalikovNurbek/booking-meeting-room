import { parseDate } from '@internationalized/date'

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'UTC',
	weekday: 'long',
	day: 'numeric',
	month: 'long',
})

function toUtcDate(date: string): Date {
	return parseDate(date).toDate('UTC')
}

export function formatDateLabel(date: string): string {
	return DATE_LABEL_FORMATTER.format(toUtcDate(date))
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60

	if (hours === 0) {
		return `${rest}m`
	}

	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** `'10:00'`, `'11:00'` → `'10:00–11:00'`. */
export function formatRange(start: string, end: string): string {
	return `${start}–${end}`
}
