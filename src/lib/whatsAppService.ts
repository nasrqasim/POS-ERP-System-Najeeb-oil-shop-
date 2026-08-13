/**
 * Shared WhatsApp Service for AL HADEED TRADERS ERP
 * Normalizes phone numbers and handles native WhatsApp Desktop deep-linking (whatsapp://)
 * with graceful web browser fallbacks.
 */

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "92" + clean.substring(1);
  } else if (clean.length === 10 && clean.startsWith("3")) {
    clean = "92" + clean;
  }
  return clean;
}

export function openWhatsAppLink(phone: string, text: string): void {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone) {
    throw new Error("Recipient phone number is empty or invalid.");
  }

  const encodedText = encodeURIComponent(text);
  const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

  // Attempt native WhatsApp Desktop app launch via OS protocol
  window.location.href = appUrl;

  // Graceful browser fallback if desktop app protocol fails or is unavailable
  setTimeout(() => {
    if (!document.hidden) {
      window.open(webUrl, "erp_whatsapp_window");
    }
  }, 1500);
}
