export interface BookAppearance {
  primaryColor: string;
  accentColor: string;
  height: number;
  width: number;
  depth: number;
  lean: number;
  borderRadius: number;
  spineStyle: "bands" | "rule" | "frame" | "ornament" | "plain";
  materialStyle: "cloth" | "leather" | "paper" | "linen";
  titlePosition: "top" | "middle" | "low";
  mark: string;
}

const palettes = [
  ["#193f3a", "#d7b66f"],
  ["#692f3d", "#ead7b7"],
  ["#233e66", "#d9a441"],
  ["#5f482d", "#dfc99b"],
  ["#76556f", "#f0d8cb"],
  ["#40593e", "#f0ca83"],
  ["#854634", "#f4dfc2"],
  ["#353244", "#cab1dc"],
  ["#625835", "#f0dfaa"],
  ["#3a5863", "#f3d2a7"],
  ["#8d4f57", "#fff0d8"],
  ["#234738", "#d9b65f"],
] as const;

const minimumAccentContrast = 4.5;

const bookMarks = ["◆", "◇", "◈", "⌁", "❖", "✧", "⋮", "⌘", "◒", "⋄"] as const;

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sample(seed: number, shift: number): number {
  let value = seed + Math.imul(shift + 1, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 4_294_967_296;
}

function choice<T>(items: readonly T[], unit: number): T {
  return items[
    Math.min(items.length - 1, Math.floor(unit * items.length))
  ] as T;
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return (
    channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  );
}

export function getColorContrastRatio(
  firstColor: string,
  secondColor: string,
): number {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

export function getBookAppearance(seedValue: string): BookAppearance {
  const seed = hashSeed(seedValue);
  const palette = choice(palettes, sample(seed, 0));
  if (getColorContrastRatio(palette[0], palette[1]) < minimumAccentContrast) {
    throw new Error("Book palette title colour must meet the contrast target.");
  }
  return {
    primaryColor: palette[0],
    accentColor: palette[1],
    height: Math.round(184 + sample(seed, 1) * 54),
    width: Math.round(14 + sample(seed, 2) * 8),
    depth: Math.round(8 + sample(seed, 3) * 12),
    lean: Number((-3.2 + sample(seed, 4) * 6.4).toFixed(2)),
    borderRadius: Math.round(2 + sample(seed, 5) * 8),
    spineStyle: choice(
      ["bands", "rule", "frame", "ornament", "plain"] as const,
      sample(seed, 6),
    ),
    materialStyle: choice(
      ["cloth", "leather", "paper", "linen"] as const,
      sample(seed, 7),
    ),
    titlePosition: "middle",
    mark: choice(bookMarks, sample(seed, 9)),
  };
}
