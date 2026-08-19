import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

function markStorySceneBreaks(html: string): string {
  return html.replace(
    /<p(?![^>]*\bdata-scene-break\s*=)([^>]*)>(\s*#{2,}\s*)<\/p>/giu,
    '<p$1 data-scene-break="true">$2</p>',
  );
}

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
  const sanitised = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "span",
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
    ALLOWED_ATTR: ["href", "title", "target", "rel", "data-drop-cap"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  return markStorySceneBreaks(sanitised);
}
