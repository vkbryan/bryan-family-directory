/**
 * Hotmail, Outlook, Live and MSN addresses (including country versions like
 * hotmail.co.uk). Microsoft sometimes accepts our sign-in emails and then
 * hides them, so these get extra advice on the code screen.
 */
export function isMicrosoftEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return /^(hotmail|outlook|live|msn|windowslive|passport)\.[a-z.]+$/.test(domain);
}
