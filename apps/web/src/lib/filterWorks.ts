export interface FilterableWork {
  title: string;
  publicationType: string;
  genres: string[];
  tags: string[];
}

export function matchesWork(
  work: FilterableWork,
  query: string,
  publicationType: string,
): boolean {
  const normalisedQuery = query.trim().toLowerCase();
  const haystack = [work.title, ...work.genres, ...work.tags]
    .join(" ")
    .toLowerCase();
  return (
    (!normalisedQuery || haystack.includes(normalisedQuery)) &&
    (!publicationType || work.publicationType === publicationType)
  );
}
