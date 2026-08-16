export interface FilterableWork {
  title: string;
  publicationType: string;
  genres: string[];
}

export function matchesWork(
  work: FilterableWork,
  query: string,
  publicationType: string,
): boolean {
  const normalisedQuery = query.trim().toLowerCase();
  const haystack = [work.title, ...work.genres].join(" ").toLowerCase();
  return (
    (!normalisedQuery || haystack.includes(normalisedQuery)) &&
    (!publicationType || work.publicationType === publicationType)
  );
}
