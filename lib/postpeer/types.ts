/**
 * PostPeer API Types
 */

export type PlatformType =
  | "twitter"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "bluesky"
  | "threads";

export type ConnectionStatus = "connected" | "error" | "pending";

export type MediaType = "image" | "video";

export interface PlatformCapability {
  maxTextLength: number;
  supportsImages: boolean;
  supportsVideo: boolean;
  maxImages: number;
  maxVideos: number;
  maxImageSize: number; // bytes
  maxVideoSize: number; // bytes
  supportedImageFormats: string[];
  supportedVideoFormats: string[];
}

export const PLATFORM_CAPABILITIES: Record<PlatformType, PlatformCapability> = {
  twitter: {
    maxTextLength: 280,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 4,
    maxVideos: 1,
    maxImageSize: 5 * 1024 * 1024,
    maxVideoSize: 512 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    supportedVideoFormats: ["mp4", "mov"],
  },
  facebook: {
    maxTextLength: 63206,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 10,
    maxVideos: 1,
    maxImageSize: 10 * 1024 * 1024,
    maxVideoSize: 1024 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png", "gif", "bmp"],
    supportedVideoFormats: ["mp4", "mov", "avi"],
  },
  instagram: {
    maxTextLength: 2200,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 10,
    maxVideos: 1,
    maxImageSize: 8 * 1024 * 1024,
    maxVideoSize: 100 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png"],
    supportedVideoFormats: ["mp4", "mov"],
  },
  linkedin: {
    maxTextLength: 3000,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 9,
    maxVideos: 1,
    maxImageSize: 10 * 1024 * 1024,
    maxVideoSize: 200 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png", "gif"],
    supportedVideoFormats: ["mp4", "mov", "avi"],
  },
  youtube: {
    maxTextLength: 5000,
    supportsImages: false,
    supportsVideo: true,
    maxImages: 0,
    maxVideos: 1,
    maxImageSize: 0,
    maxVideoSize: 128 * 1024 * 1024 * 1024,
    supportedImageFormats: [],
    supportedVideoFormats: ["mp4", "mov", "avi", "wmv", "flv", "webm"],
  },
  tiktok: {
    maxTextLength: 2200,
    supportsImages: false,
    supportsVideo: true,
    maxImages: 0,
    maxVideos: 1,
    maxImageSize: 0,
    maxVideoSize: 287 * 1024 * 1024,
    supportedImageFormats: [],
    supportedVideoFormats: ["mp4", "mov"],
  },
  pinterest: {
    maxTextLength: 500,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 1,
    maxVideos: 1,
    maxImageSize: 32 * 1024 * 1024,
    maxVideoSize: 2 * 1024 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png"],
    supportedVideoFormats: ["mp4", "mov"],
  },
  bluesky: {
    maxTextLength: 300,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 4,
    maxVideos: 1,
    maxImageSize: 1 * 1024 * 1024,
    maxVideoSize: 50 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    supportedVideoFormats: ["mp4"],
  },
  threads: {
    maxTextLength: 500,
    supportsImages: true,
    supportsVideo: true,
    maxImages: 10,
    maxVideos: 1,
    maxImageSize: 8 * 1024 * 1024,
    maxVideoSize: 100 * 1024 * 1024,
    supportedImageFormats: ["jpg", "jpeg", "png"],
    supportedVideoFormats: ["mp4", "mov"],
  },
};

export interface PlatformConnection {
  id: string;
  platform: PlatformType;
  status: ConnectionStatus;
  username: string;
  profilePicture?: string;
  displayName?: string;
  connectedAt: string;
  lastUsed?: string;
  stats?: {
    followers?: number;
    following?: number;
    posts?: number;
  };
  error?: string;
}

export interface MediaFile {
  id: string;
  type: MediaType;
  url: string;
  file?: File;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // for videos
  thumbnail?: string;
}

export interface PostContent {
  text: string;
  media: MediaFile[];
  platforms: PlatformType[];
  scheduledAt?: string; // ISO 8601
  timezone?: string; // IANA timezone
}

export interface Post {
  id: string;
  content: PostContent;
  status: "draft" | "scheduled" | "published" | "failed";
  createdAt: string;
  publishedAt?: string;
  results?: PostResult[];
}

export interface PostResult {
  platform: PlatformType;
  status: "success" | "failed";
  postUrl?: string;
  error?: string;
  publishedAt?: string;
}

export interface PostPeerConfig {
  apiKey: string;
  apiUrl?: string;
}
