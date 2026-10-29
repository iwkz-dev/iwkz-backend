/**
 * Timezone helpers for Europe/Berlin (CET / CEST)
 */

const BERLIN_TIMEZONE = 'Europe/Berlin';

/**
 * Returns Berlin's UTC offset label for the given date, e.g. "GMT+1" (CET) or "GMT+2" (CEST)
 */
export const getBerlinOffset = (date: Date = new Date()): string | undefined =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: BERLIN_TIMEZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

/**
 * Checks whether Berlin is on summer time (CEST) on the given date.
 * Without arguments it checks today. Uses noon UTC to stay clear of the switch at night.
 */
export const isCEST = (
  day?: number,
  month?: number,
  year?: number
): boolean => {
  const date =
    day && month && year
      ? new Date(Date.UTC(year, month - 1, day, 12))
      : new Date();

  return getBerlinOffset(date) === 'GMT+2';
};

/**
 * Adds one hour to a "HH:mm" time string, wrapping at midnight.
 * Returns the input unchanged when it is not a valid time.
 */
export const addOneHour = (time: string): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? '');
  if (!match) {
    return time;
  }

  const hour = (Number(match[1]) + 1) % 24;
  return `${hour < 10 ? `0${hour}` : hour}:${match[2]}`;
};
