export function featuredFirstShuffle<T>(
  items: T[],
  isFeatured: (item: T) => boolean,
  random: () => number = Math.random,
): T[] {
  const shuffle = (values: T[]) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target]!, result[index]!];
    }
    return result;
  };

  return [
    ...shuffle(items.filter(isFeatured)),
    ...shuffle(items.filter((item) => !isFeatured(item))),
  ];
}
