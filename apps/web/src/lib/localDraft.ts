export interface LocalWorkDraft {
  version: 1;
  savedAt: string;
  fields: Record<string, string | boolean>;
}

export function localWorkDraftKey(workId?: string): string {
  return `mums-bookshelf:work-draft:${workId || "new"}`;
}

export function parseLocalWorkDraft(
  stored: string | null,
): LocalWorkDraft | null {
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<LocalWorkDraft>;
    if (
      value.version !== 1 ||
      typeof value.savedAt !== "string" ||
      !value.fields ||
      typeof value.fields !== "object" ||
      Array.isArray(value.fields)
    ) {
      return null;
    }
    return value as LocalWorkDraft;
  } catch {
    return null;
  }
}
