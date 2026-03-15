import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function formatPhoneE164(phone: string, defaultCountry: string = 'PK'): string | null {
  if (!phone) return null;

  try {
    // Remove any spaces or special characters except + and digits
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned) return null;

    if (isValidPhoneNumber(cleaned, defaultCountry as any)) {
      const parsed = parsePhoneNumber(cleaned, defaultCountry as any);
      return parsed.format('E.164');
    }

    // Try parsing with the full E.164 number (already has +country code)
    if (cleaned.startsWith('+') && isValidPhoneNumber(cleaned)) {
      const parsed = parsePhoneNumber(cleaned);
      return parsed.format('E.164');
    }

    // Invalid phone number — return null instead of the original
    return null;
  } catch {
    return null;
  }
}

export function formatPhoneDisplay(phone: string): string | null {
  if (!phone) return null;

  try {
    const parsed = parsePhoneNumber(phone);
    if (parsed) {
      return parsed.formatInternational();
    }
    return phone;
  } catch {
    return phone;
  }
}
