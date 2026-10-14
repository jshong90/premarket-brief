import { cutoffMinuteForDate } from '../../lib/ranges';


export function formatFuturesSession(sessionDate: string) {
  const date = new Date(`${sessionDate}T12:00:00Z`);
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const formatDate = (value: Date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(value);
  return `${formatDate(previousDate)} 6:00 PM–${formatDate(date)} 9:${cutoffMinuteForDate(sessionDate)} AM ET`;
}
