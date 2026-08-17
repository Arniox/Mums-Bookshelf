const allowedTags = new Set([
  "p",
  "br",
  "em",
  "strong",
  "u",
  "s",
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

function applyInlineFormatting(
  content: Node,
  document: Document,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  strikethrough: boolean,
) {
  let result = content;
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
  if (underline) {
    const underlined = document.createElement("u");
    underlined.append(result);
    result = underlined;
  }
  if (strikethrough) {
    const struck = document.createElement("s");
    struck.append(result);
    result = struck;
  }
  return result;
}

function normaliseNode(node: Node, document: Document): Node[] {
  if (node.nodeType === 3)
    return [
      document.createTextNode(node.textContent?.replace(/\u00a0/g, " ") || ""),
    ];
  if (node.nodeType !== 1) return [];

  const source = node as HTMLElement;
  const tagName = source.tagName.toLowerCase();
  const style = (source.getAttribute("style") || "").toLowerCase();
  const isWordListItem = /\bmso-list\s*:/u.test(style);
  const tag =
    tagName === "h1" || tagName === "h5" || tagName === "h6"
      ? "h2"
      : tagName === "b"
        ? "strong"
        : tagName === "i"
          ? "em"
          : tagName === "strike" || tagName === "del"
            ? "s"
            : isWordListItem
              ? "li"
              : tagName === "div"
                ? "p"
                : tagName;
  const bold =
    tagName !== "b" &&
    tagName !== "strong" &&
    /font-weight\s*:\s*(?:bold|[6-9]00)/u.test(style);
  const italic =
    tagName !== "i" &&
    tagName !== "em" &&
    /font-style\s*:\s*italic/u.test(style);
  const underline =
    tagName !== "u" &&
    /text-decoration(?:-line)?\s*:[^;]*underline/u.test(style);
  const strikethrough =
    tagName !== "s" &&
    tagName !== "strike" &&
    tagName !== "del" &&
    /text-decoration(?:-line)?\s*:[^;]*(?:line-through|strike)/u.test(style);

  if (tag === "span" || tag === "font" || !allowedTags.has(tag)) {
    const fragment = document.createDocumentFragment();
    appendChildren(source, fragment, document);
    return [
      applyInlineFormatting(
        fragment,
        document,
        bold,
        italic,
        underline,
        strikethrough,
      ),
    ];
  }

  const element = document.createElement(tag);
  if (tag === "a") {
    const href = source.getAttribute("href");
    if (isSafeLink(href)) element.setAttribute("href", href!.trim());
    const title = source.getAttribute("title");
    if (title) element.setAttribute("title", title);
  }
  appendChildren(source, element, document);
  if (isWordListItem) {
    element.dataset.wordList = /^\s*(?:\d+|[a-z])[.)]\s/iu.test(
      source.textContent || "",
    )
      ? "ol"
      : "ul";
  }
  if (tag === "p" || tag === "li") {
    if (
      source.dataset.indent === "true" ||
      /(?:margin|padding)-left\s*:\s*(?!0(?:[a-z%]+)?(?:;|$))/u.test(style)
    )
      element.dataset.indent = "true";
    if (
      source.dataset.firstLineIndent === "true" ||
      /text-indent\s*:\s*(?!0(?:[a-z%]+)?(?:;|$))/u.test(style)
    )
      element.dataset.firstLineIndent = "true";
  }
  if (tag === "p" && bold) {
    const strong = document.createElement("strong");
    strong.append(...element.childNodes);
    element.append(strong);
  }
  if (tag === "p" && italic) {
    const em = document.createElement("em");
    em.append(...element.childNodes);
    element.append(em);
  }
  if (tag === "p" && underline) {
    const underlined = document.createElement("u");
    underlined.append(...element.childNodes);
    element.append(underlined);
  }
  if (tag === "p" && strikethrough) {
    const struck = document.createElement("s");
    struck.append(...element.childNodes);
    element.append(struck);
  }
  return [element];
}

export function normaliseStoryHtml(html: string, document: Document) {
  const source = document.implementation.createHTMLDocument("Story editor");
  source.body.innerHTML = html;
  const output = document.createElement("div");
  appendChildren(source.body, output, document);
  let currentList: HTMLElement | undefined;
  Array.from(output.children).forEach((element) => {
    if (element.tagName !== "LI" || !element.dataset.wordList) {
      currentList = undefined;
      return;
    }
    const listTag = element.dataset.wordList as "ol" | "ul";
    if (!currentList || currentList.tagName.toLowerCase() !== listTag) {
      currentList = document.createElement(listTag);
      element.before(currentList);
    }
    delete element.dataset.wordList;
    currentList.append(element);
  });
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
  const cleanedValue = value.replace(/<!--[\s\S]*?-->/gu, "").trim();
  if (/<[a-z][\s\S]*>/iu.test(cleanedValue))
    return normaliseStoryHtml(cleanedValue, document);

  const lines = cleanedValue.replace(/\r\n?/g, "\n").split("\n");
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
