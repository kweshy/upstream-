export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D+/g, "");
  let national = digits;
  if (national.startsWith("254")) national = national.slice(3);
  else if (national.startsWith("0")) national = national.slice(1);
  else if (national.length === 9) {
    // e.g. 712345678
  } else return null;
  if (!/^[17]\d{8}$/.test(national)) return null;
  return "254" + national;
}

/** Deterministic synthetic email used for phone+PIN sign-in (no real mailbox). */
export function phoneEmail(phone: string): string {
  const n = normalizePhone(phone);
  if (!n) throw new Error("Invalid phone number");
  return `${n}@phone.upstream.app`;
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone);
  if (!n) return phone;
  return `0${n.slice(3, 6)} ${n.slice(6)}`;
}
