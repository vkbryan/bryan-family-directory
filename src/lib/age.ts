/** Whole years old on `today`, using month and day when known. */
export function ageOn(today: Date, year: number, month: number | null, day: number | null) {
  let age = today.getFullYear() - year;
  if (month !== null) {
    const m = today.getMonth() + 1;
    if (m < month || (m === month && day !== null && today.getDate() < day)) age--;
  }
  return age;
}
