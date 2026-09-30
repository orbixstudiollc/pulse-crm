/** Allowed avatar MIME types and the file extension stored for each. */
export const AVATAR_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Returns an error message for an unacceptable avatar file, or null if it is fine. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!Object.hasOwn(AVATAR_EXTENSIONS, file.type)) {
    return "Avatar must be a PNG, JPEG, WebP or GIF image";
  }
  if (file.size <= 0) return "Avatar file is empty";
  if (file.size > MAX_AVATAR_BYTES) return "Avatar must be 2 MB or smaller";
  return null;
}
