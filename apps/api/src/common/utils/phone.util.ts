import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function formatPhoneE164(phone: string, defaultCountry: string = 'PK'): string | null {
  if (!phone) return null;
  
  try {
    // Remove any spaces or special characters except + and digits
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    if (isValidPhoneNumber(cleaned, defaultCountry as any)) {
      const parsed = parsePhoneNumber(cleaned, defaultCountry as any);
      return parsed.format('E.164');
    }
    
    // If not valid, try parsing anyway
    const parsed = parsePhoneNumber(cleaned, defaultCountry as any);
    if (parsed) {
      return parsed.format('E.164');
    }
    
    return phone; // Return original if can't parse
  } catch {
    return phone; // Return original if parsing fails
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