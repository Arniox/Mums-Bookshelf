export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function calculateReadingTime(
  content: string,
  wordsPerMinute = 220,
): number {
  const words = content.trim() ? content.trim().split(/\s+/u).length : 0;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function areSameExternalUrls(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) return false;
  const normalise = (value: string) => {
    const url = new URL(value.trim());
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.href;
  };
  try {
    return normalise(left) === normalise(right);
  } catch {
    return left.trim() === right.trim();
  }
}

export function detectSocialProvider(
  value: string,
): "facebook" | "instagram" | "threads" | "x" | "other" {
  const hostname = new URL(value).hostname.replace(/^www\./, "");
  if (hostname === "facebook.com" || hostname === "fb.watch") return "facebook";
  if (hostname === "instagram.com") return "instagram";
  if (hostname === "threads.net") return "threads";
  if (hostname === "x.com" || hostname === "twitter.com") return "x";
  return "other";
}
