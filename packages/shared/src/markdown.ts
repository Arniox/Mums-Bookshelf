import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

export function sanitiseMarkdown(markdown: string): string {
  const protocolSafeMarkdown = markdown.replace(
    /\b(?:javascript|vbscript|data):/giu,
    "",
  );
  const raw = marked.parse(protocolSafeMarkdown, {
    async: false,
    gfm: true,
    breaks: false,
  });
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "em",
      "strong",
      "a",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "h4",
      "hr",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

export function sanitiseHomepageHeading(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["br", "b", "i", "em", "strong", "u", "s", "a"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  }).trim();
}
