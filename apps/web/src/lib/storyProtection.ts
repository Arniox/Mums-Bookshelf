const hasStorySelection = (story: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  return [...Array.from({ length: selection.rangeCount })].some((_, index) =>
    selection.getRangeAt(index).intersectsNode(story),
  );
};

export const protectStoryContent = (story: HTMLElement | null) => {
  if (!story || story.dataset.copyProtectionEnabled === "true") return;
  story.dataset.copyProtectionEnabled = "true";

  const preventStoryAction = (event: Event) => event.preventDefault();
  story.addEventListener("contextmenu", preventStoryAction);
  story.addEventListener("dragstart", preventStoryAction);
  story.addEventListener("selectstart", preventStoryAction);

  document.addEventListener("selectionchange", () => {
    if (hasStorySelection(story)) window.getSelection()?.removeAllRanges();
  });

  document.addEventListener("copy", (event) => {
    if (hasStorySelection(story)) event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    if (!hasStorySelection(story) || !(event.ctrlKey || event.metaKey)) return;
    if (["c", "x", "s", "u", "p"].includes(event.key.toLowerCase()))
      event.preventDefault();
  });
};
