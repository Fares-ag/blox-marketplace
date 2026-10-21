/** Qatar Credit Bureau month-end is a Qatar calendar event, not UTC. */
export const QATAR_TIME_ZONE = 'Asia/Qatar';

const YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: QATAR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date in Qatar as YYYY-MM-DD. */
export function qatarYmd(date: Date): string {
  return YMD.format(date);
}

/** Reporting period YYYY-MM in Qatar. */
export function reportingPeriodOf(date: Date): string {
  return qatarYmd(date).slice(0, 7);
}

export function isLastCalendarDayQatar(date: Date): boolean {
  const ymd = qatarYmd(date);
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === lastDay;
}
