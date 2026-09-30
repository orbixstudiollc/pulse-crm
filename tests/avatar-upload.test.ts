// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AVATAR_EXTENSIONS, MAX_AVATAR_BYTES, validateAvatarFile } from "@/lib/security/avatar";

describe("validateAvatarFile", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])("accepts %s", (type) => {
    expect(validateAvatarFile({ type, size: 1024 })).toBeNull();
  });

  it.each(["image/svg+xml", "text/html", "application/octet-stream", "", "toString"])(
    "rejects type %j",
    (type) => {
      expect(validateAvatarFile({ type, size: 1024 })).toMatch(/PNG, JPEG, WebP or GIF/);
    },
  );

  it("accepts exactly 2 MB and rejects anything larger", () => {
    expect(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES + 1 })).toMatch(/2 MB/);
  });

  it("rejects empty files", () => {
    expect(validateAvatarFile({ type: "image/png", size: 0 })).toMatch(/empty/);
  });

  it("maps every allowed type to a fixed extension", () => {
    expect(AVATAR_EXTENSIONS).toEqual({
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    });
  });
});
