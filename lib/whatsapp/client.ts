/**
 * WhatsApp Business Cloud API v20.0 Client
 * Handles all direct API communication with Meta's WhatsApp Business Platform.
 */

const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================
// Types
// ============================================================

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface WhatsAppTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppMediaMessage {
  type: "image" | "document" | "video" | "audio";
  url: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
}

// ============================================================
// Send Template Message
// ============================================================

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
      image?: { link: string };
      document?: { link: string; filename: string };
    }>;
  }>
): Promise<WhatsAppSendResult> {
  try {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && { components }),
      },
    };

    const res = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: data.error?.code?.toString() || res.status.toString(),
          message: data.error?.message || "Unknown error",
        },
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

// ============================================================
// Send Text Message (within 24h reply window)
// ============================================================

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
  previewUrl = false
): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text, preview_url: previewUrl },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: data.error?.code?.toString() || res.status.toString(),
          message: data.error?.message || "Unknown error",
        },
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

// ============================================================
// Send Media Message
// ============================================================

export async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  media: WhatsAppMediaMessage
): Promise<WhatsAppSendResult> {
  try {
    const mediaPayload: Record<string, unknown> = {
      link: media.url,
    };
    if (media.caption) mediaPayload.caption = media.caption;
    if (media.filename) mediaPayload.filename = media.filename;

    const res = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: media.type,
          [media.type]: mediaPayload,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: data.error?.code?.toString() || res.status.toString(),
          message: data.error?.message || "Unknown error",
        },
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

// ============================================================
// Fetch Templates from Meta
// ============================================================

export async function fetchTemplates(
  wabaId: string,
  accessToken: string
): Promise<{ templates: WhatsAppTemplate[]; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${wabaId}/message_templates?limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        templates: [],
        error: data.error?.message || "Failed to fetch templates",
      };
    }

    return {
      templates: (data.data || []).map(
        (t: {
          id: string;
          name: string;
          language: string;
          category: string;
          status: string;
          components: WhatsAppTemplateComponent[];
        }) => ({
          id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components || [],
        })
      ),
    };
  } catch (err) {
    return {
      templates: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ============================================================
// Verify Webhook Signature
// ============================================================

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSignature =
      "sha256=" +
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return expectedSignature === signature;
  } catch {
    return false;
  }
}

// ============================================================
// Get Phone Number Details
// ============================================================

export async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<{
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: string;
  messaging_limit?: string;
  error?: string;
}> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,messaging_limit`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error?.message || "Failed to get phone details" };
    }

    return {
      verified_name: data.verified_name,
      display_phone_number: data.display_phone_number,
      quality_rating: data.quality_rating,
      messaging_limit: data.messaging_limit,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}
