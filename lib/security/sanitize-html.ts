import DOMPurify from "dompurify";

// Raster-only inline images; SVG data URIs are never kept.
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

let hooksRegistered = false;

function registerHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (node.nodeName !== "IMG" || data.attrName !== "src") return;
    if (SAFE_DATA_IMAGE.test(data.attrValue)) {
      data.forceKeepAttr = true;
    } else if (/^data:/i.test(data.attrValue)) {
      // DOMPurify keeps any data: URI on <img> by default; drop the non-raster ones.
      data.keepAttr = false;
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Sanitize untrusted inbound email HTML for rendering. Fails closed: without a
 * DOM (e.g. during SSR) no HTML is returned at all.
 */
export function sanitizeEmailHtml(html: string): string {
  if (typeof window === "undefined" || !DOMPurify.isSupported) return "";
  registerHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script", "style", "iframe", "frame", "frameset", "object", "embed", "form",
      "input", "button", "textarea", "select", "option", "svg", "math", "link",
      "meta", "base", "template", "video", "audio", "source", "track",
    ],
    FORBID_ATTR: ["style", "class", "id", "srcset", "formaction", "xlink:href", "action", "ping"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
    ADD_ATTR: ["target"],
  });
}
