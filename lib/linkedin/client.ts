/**
 * LinkedIn API Client
 * Handles all direct API communication with LinkedIn.
 * Uses LinkedIn's Marketing & Messaging APIs.
 */

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

// ============================================================
// Types
// ============================================================

export interface LinkedInActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export interface LinkedInProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  profilePicture?: string;
  vanityName?: string;
}

// ============================================================
// Send Connection Request
// ============================================================

export async function sendConnectionRequest(
  accessToken: string,
  targetLinkedInId: string,
  note?: string
): Promise<LinkedInActionResult> {
  try {
    const body: Record<string, unknown> = {
      inviteeUrn: `urn:li:person:${targetLinkedInId}`,
      message: note ? note.substring(0, 300) : undefined, // 300 char max
    };

    const res = await fetch(
      `${LINKEDIN_API_BASE}/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: res.status.toString(),
          message: errorData.message || `HTTP ${res.status}`,
        },
      };
    }

    return { success: true };
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
// Send Message (requires existing connection)
// ============================================================

export async function sendMessage(
  accessToken: string,
  senderLinkedInId: string,
  targetLinkedInId: string,
  messageBody: string
): Promise<LinkedInActionResult> {
  try {
    const body = {
      recipients: [`urn:li:person:${targetLinkedInId}`],
      subject: "",
      body: {
        contentType: "TEXT",
        text: messageBody,
      },
      messageType: "MEMBER_TO_MEMBER",
      senderUrn: `urn:li:person:${senderLinkedInId}`,
    };

    const res = await fetch(
      `${LINKEDIN_API_BASE}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: res.status.toString(),
          message: errorData.message || `HTTP ${res.status}`,
        },
      };
    }

    return { success: true };
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
// View Profile (triggers a profile view notification)
// ============================================================

export async function viewProfile(
  accessToken: string,
  targetLinkedInUrl: string
): Promise<LinkedInActionResult> {
  try {
    // LinkedIn doesn't have a direct "view profile" API.
    // This fetches the profile which may register as a view
    // depending on the API version and permissions.
    const res = await fetch(
      `${LINKEDIN_API_BASE}/people/(vanityName:${extractVanityName(targetLinkedInUrl)})`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: res.status.toString(),
          message: errorData.message || `HTTP ${res.status}`,
        },
      };
    }

    const data = await res.json();
    return { success: true, data };
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
// Endorse Skill
// ============================================================

export async function endorseSkill(
  accessToken: string,
  targetLinkedInId: string,
  skillName: string
): Promise<LinkedInActionResult> {
  try {
    const res = await fetch(
      `${LINKEDIN_API_BASE}/normSkills/${encodeURIComponent(skillName)}/endorsements`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          endorsee: `urn:li:person:${targetLinkedInId}`,
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: res.status.toString(),
          message: errorData.message || `HTTP ${res.status}`,
        },
      };
    }

    return { success: true };
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
// Get Current User Profile
// ============================================================

export async function getCurrentProfile(
  accessToken: string
): Promise<{ profile?: LinkedInProfile; error?: string }> {
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { error: errorData.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      profile: {
        id: data.id,
        localizedFirstName: data.localizedFirstName,
        localizedLastName: data.localizedLastName,
        vanityName: data.vanityName,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

// ============================================================
// Exchange OAuth Code for Tokens
// ============================================================

export async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error_description || "OAuth token exchange failed" };
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

// ============================================================
// Refresh Token
// ============================================================

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error_description || "Token refresh failed" };
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

// ============================================================
// Helpers
// ============================================================

function extractVanityName(linkedInUrl: string): string {
  const match = linkedInUrl.match(/linkedin\.com\/in\/([^/?\s]+)/);
  return match?.[1] || linkedInUrl;
}
