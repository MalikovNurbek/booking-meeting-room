import { fromDate, toCalendarDate } from '@internationalized/date'

export const BUSINESS_TIME_ZONE = 'Asia/Bishkek'

export interface NowContext {
	date: string
	minutes: number
}

export function nowContext(
	at: Date = new Date(),
	timeZone: string = BUSINESS_TIME_ZONE
): NowContext {
	const zoned = fromDate(at, timeZone)

	return {
		date: toCalendarDate(zoned).toString(),
		minutes: zoned.hour * 60 + zoned.minute,
	}
}
