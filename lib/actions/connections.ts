"use server";

import { postpeerClient } from "@/lib/postpeer/client";
import { PlatformType, PlatformConnection } from "@/lib/postpeer/types";

/**
 * Get PostPeer API key from environment or database
 */
async function getPostPeerApiKey(): Promise<string> {
  const apiKey = process.env.POSTPEER_API_KEY;

  if (!apiKey) {
    throw new Error("PostPeer API key not configured");
  }

  return apiKey;
}

/**
 * Initialize PostPeer client with API key
 */
async function initClient() {
  const apiKey = await getPostPeerApiKey();
  return postpeerClient.initialize({ apiKey });
}

/**
 * Fetch all platform connections
 */
export async function getConnections(): Promise<{
  success: boolean;
  data?: PlatformConnection[];
  error?: string;
}> {
  try {
    const client = await initClient();
    const connections = await client.getConnections();

    return {
      success: true,
      data: connections,
    };
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch connections",
    };
  }
}

/**
 * Get OAuth URL for platform connection
 */
export async function getOAuthUrl(
  platform: PlatformType
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // In a real implementation, this would call PostPeer's OAuth initiation endpoint
    // For now, we'll construct a mock URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`;
    const state = `${platform}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store state in session or database for verification
    const oauthUrl = `https://api.postpeer.com/oauth/${platform}?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return {
      success: true,
      url: oauthUrl,
    };
  } catch (error) {
    console.error("Failed to get OAuth URL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get OAuth URL",
    };
  }
}

/**
 * Complete OAuth flow with auth code
 */
export async function connectPlatform(
  platform: PlatformType,
  authCode: string
): Promise<{
  success: boolean;
  data?: PlatformConnection;
  error?: string;
}> {
  try {
    const client = await initClient();
    const connection = await client.connectPlatform(platform, authCode);

    return {
      success: true,
      data: connection,
    };
  } catch (error) {
    console.error("Failed to connect platform:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect platform",
    };
  }
}

/**
 * Disconnect a platform
 */
export async function disconnectPlatform(
  connectionId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await initClient();
    await client.disconnectPlatform(connectionId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to disconnect platform:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disconnect platform",
    };
  }
}

/**
 * Reconnect an expired connection
 */
export async function reconnectPlatform(
  connectionId: string,
  platform: PlatformType
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // First disconnect the old connection
    await disconnectPlatform(connectionId);

    // Then get a new OAuth URL
    return await getOAuthUrl(platform);
  } catch (error) {
    console.error("Failed to reconnect platform:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reconnect platform",
    };
  }
}
