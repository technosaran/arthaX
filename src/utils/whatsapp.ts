/**
 * Utility to send WhatsApp messages using Meta Cloud API (Graph API)
 */
export async function sendWhatsAppTextMessage({
  phoneNumberId,
  to,
  message,
}: {
  phoneNumberId?: string;
  to: string;
  message: string;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const pId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !pId) {
    console.warn("[WhatsApp API] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in environment.");
    return {
      success: false,
      error: "WhatsApp API credentials not configured in environment variables",
    };
  }

  const cleanTo = to.replace(/[^0-9]/g, "");
  if (!cleanTo) {
    return { success: false, error: "Invalid recipient phone number format" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://graph.facebook.com/v21.0/${pId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      console.error("[WhatsApp API] Meta API Error:", data);
      return { success: false, error: data?.error?.message || "Failed to send WhatsApp message" };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Network error calling Meta API";
    console.error("[WhatsApp API] Request failed:", errMsg);
    return { success: false, error: errMsg };
  }
}
