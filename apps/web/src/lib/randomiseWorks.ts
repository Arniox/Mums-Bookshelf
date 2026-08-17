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

function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

export function dailyOrderSalt(date = new Date()): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

export function dailyFeaturedOrder<T>(
  items: T[],
  isFeatured: (item: T) => boolean,
  getKey: (item: T) => string,
  salt = dailyOrderSalt(),
): T[] {
  const orderGroup = (values: T[]) =>
    [...values].sort((left, right) => {
      const difference = hash(`${salt}:${getKey(left)}`) - hash(`${salt}:${getKey(right)}`);
      return difference || getKey(left).localeCompare(getKey(right));
    });

  return [
    ...orderGroup(items.filter(isFeatured)),
    ...orderGroup(items.filter((item) => !isFeatured(item))),
  ];
}
