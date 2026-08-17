function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

function isSafeLink(value: string | null) {
  return Boolean(value && /^(?:https?:|mailto:)/iu.test(value.trim()));
}

export function wordHtmlToMarkdown(html: string, document: Document) {
  const source = document.implementation.createHTMLDocument("Word paste");
  source.body.innerHTML = html;

  const renderChildren = (node: Node): string =>
    Array.from(node.childNodes).map(render).join("");

  const renderList = (element: HTMLElement, ordered: boolean) => {
    const items = Array.from(element.children).filter(
      (child): child is HTMLElement => child.tagName === "LI",
    );
    return items
      .map((item, index) => `${ordered ? `${index + 1}.` : "-"} ${renderChildren(item).trim()}`)
      .join("\n");
  };

  const render = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return cleanText(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const content = renderChildren(element).trim();
    const style = (element.getAttribute("style") || "").toLowerCase();

    switch (element.tagName.toLowerCase()) {
      case "br":
        return "\n";
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return `\n\n${"#".repeat(Number(element.tagName.slice(1)))} ${content}\n\n`;
      case "p":
      case "div": {
        const wordList = content.match(/^([•◦▪‣]|\d+[.)])\s+(.+)$/u);
        return `\n\n${wordList ? `${wordList[1]!.match(/^\d/u) ? wordList[1] : "-"} ${wordList[2]}` : content}\n\n`;
      }
      case "blockquote":
        return `\n\n${content
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
      case "ul":
        return `\n\n${renderList(element, false)}\n\n`;
      case "ol":
        return `\n\n${renderList(element, true)}\n\n`;
      case "li":
        return content;
      case "strong":
      case "b":
        return content ? `**${content}**` : "";
      case "em":
      case "i":
        return content ? `*${content}*` : "";
      case "a": {
        const href = element.getAttribute("href")?.trim() || "";
        return content && isSafeLink(href) ? `[${content}](${href})` : content;
      }
      default: {
        const bold = /font-weight\s*:\s*(?:bold|[6-9]00)/u.test(style);
        const italic = /font-style\s*:\s*italic/u.test(style);
        if (!content) return "";
        if (bold && italic) return `***${content}***`;
        if (bold) return `**${content}**`;
        if (italic) return `*${content}*`;
        return content;
      }
    }
  };

  return cleanMarkdown(renderChildren(source.body));
}
