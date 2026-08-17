const allowedTags = new Set([
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
]);

function isSafeLink(value: string | null) {
  return Boolean(value && /^(?:https?:|mailto:)/iu.test(value.trim()));
}

function appendChildren(
  source: Node,
  target: DocumentFragment | HTMLElement,
  document: Document,
): void {
  Array.from(source.childNodes).forEach((child) =>
    target.append(...normaliseNode(child, document)),
  );
}

function normaliseNode(node: Node, document: Document): Node[] {
  if (node.nodeType === 3)
    return [
      document.createTextNode(node.textContent?.replace(/\u00a0/g, " ") || ""),
    ];
  if (node.nodeType !== 1) return [];

  const source = node as HTMLElement;
  const tagName = source.tagName.toLowerCase();
  const tag =
    tagName === "h1" || tagName === "h5" || tagName === "h6"
      ? "h2"
      : tagName === "div"
        ? "p"
        : tagName;
  const style = (source.getAttribute("style") || "").toLowerCase();
  const bold = /font-weight\s*:\s*(?:bold|[6-9]00)/u.test(style);
  const italic = /font-style\s*:\s*italic/u.test(style);

  if (tag === "span" || !allowedTags.has(tag)) {
    const fragment = document.createDocumentFragment();
    appendChildren(source, fragment, document);
    let result: Node = fragment;
    if (bold) {
      const strong = document.createElement("strong");
      strong.append(result);
      result = strong;
    }
    if (italic) {
      const em = document.createElement("em");
      em.append(result);
      result = em;
    }
    return [result];
  }

  const element = document.createElement(tag);
  if (tag === "a") {
    const href = source.getAttribute("href");
    if (isSafeLink(href)) element.setAttribute("href", href!.trim());
    const title = source.getAttribute("title");
    if (title) element.setAttribute("title", title);
  }
  appendChildren(source, element, document);
  return [element];
}

export function normaliseStoryHtml(html: string, document: Document) {
  const source = document.implementation.createHTMLDocument("Story editor");
  source.body.innerHTML = html;
  const output = document.createElement("div");
  appendChildren(source.body, output, document);
  return output.innerHTML;
}

export function wordHtmlToStoryHtml(html: string, document: Document) {
  return normaliseStoryHtml(html, document);
}

function inlineMarkdownToHtml(value: string) {
  const output = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return output
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, '<a href="$2">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/gu, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");
}

export function storyTextToEditorHtml(value: string, document: Document) {
  if (/<[a-z][\s\S]*>/iu.test(value))
    return normaliseStoryHtml(value, document);

  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!.trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/u);
    if (heading) {
      output.push(
        `<h${heading[1]!.length}>${inlineMarkdownToHtml(heading[2]!)}</h${heading[1]!.length}>`,
      );
    } else if (/^---+$/u.test(line)) {
      output.push("<hr>");
    } else if (line.startsWith("> ")) {
      output.push(
        `<blockquote><p>${inlineMarkdownToHtml(line.slice(2))}</p></blockquote>`,
      );
    } else if (/^(?:-|\*)\s+/u.test(line)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^(?:-|\*)\s+/u.test(lines[index]!.trim())
      ) {
        items.push(
          `<li>${inlineMarkdownToHtml(lines[index]!.trim().replace(/^(?:-|\*)\s+/u, ""))}</li>`,
        );
        index += 1;
      }
      index -= 1;
      output.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\d+[.)]\s+/u.test(line)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^\d+[.)]\s+/u.test(lines[index]!.trim())
      ) {
        items.push(
          `<li>${inlineMarkdownToHtml(lines[index]!.trim().replace(/^\d+[.)]\s+/u, ""))}</li>`,
        );
        index += 1;
      }
      index -= 1;
      output.push(`<ol>${items.join("")}</ol>`);
    } else {
      output.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
    }
    index += 1;
  }
  return normaliseStoryHtml(output.join(""), document);
}
