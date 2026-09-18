/**
 * Adds calendar months to a date, clamping to the last day of the target
 * month when the source day doesn't exist there (Jan 31 + 1 month -> Feb 28,
 * not the JS Date default of rolling over into March). Calibration intervals
 * are month-based (e.g. every 6/12/24 months), so an unclamped rollover would
 * silently push due dates later for any asset last calibrated on a 29th,
 * 30th, or 31st.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth, 1); // pin to day 1 so setMonth can't overflow past the target month
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), daysInTargetMonth));
  return d;
}
