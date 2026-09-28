/**
 * PostPeer API Client
 */

import {
  PlatformConnection,
  Post,
  PostContent,
  PostPeerConfig,
  PlatformType,
} from "./types";

export class PostPeerClient {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: PostPeerConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || "https://api.postpeer.com/v1";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `API request failed: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getConnections(): Promise<PlatformConnection[]> {
    return this.request<PlatformConnection[]>("/connections");
  }

  async connectPlatform(
    platform: PlatformType,
    authCode: string,
  ): Promise<PlatformConnection> {
    return this.request<PlatformConnection>("/connections", {
      method: "POST",
      body: JSON.stringify({ platform, authCode }),
    });
  }

  async disconnectPlatform(connectionId: string): Promise<void> {
    await this.request(`/connections/${connectionId}`, {
      method: "DELETE",
    });
  }

  async createPost(content: PostContent): Promise<Post> {
    return this.request<Post>("/posts", {
      method: "POST",
      body: JSON.stringify(content),
    });
  }

  async schedulePost(content: PostContent): Promise<Post> {
    return this.request<Post>("/posts/schedule", {
      method: "POST",
      body: JSON.stringify(content),
    });
  }

  async uploadMedia(file: File): Promise<{ url: string; id: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.apiUrl}/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Media upload failed");
    }

    return response.json();
  }

  async getPosts(status?: Post["status"]): Promise<Post[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<Post[]>(`/posts${query}`);
  }

  async getPost(postId: string): Promise<Post> {
    return this.request<Post>(`/posts/${postId}`);
  }

  async deletePost(postId: string): Promise<void> {
    await this.request(`/posts/${postId}`, {
      method: "DELETE",
    });
  }
}

let clientInstance: PostPeerClient | null = null;

export function initializePostPeerClient(config: PostPeerConfig): PostPeerClient {
  clientInstance = new PostPeerClient(config);
  return clientInstance;
}

export function getPostPeerClient(): PostPeerClient {
  if (!clientInstance) {
    throw new Error(
      "PostPeer client not initialized. Call initializePostPeerClient first.",
    );
  }
  return clientInstance;
}

export const postpeerClient = {
  get: getPostPeerClient,
  initialize: initializePostPeerClient,
};
