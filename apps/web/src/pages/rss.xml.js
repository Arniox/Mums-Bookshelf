import rss from "@astrojs/rss";
import { getPublicSettings, getPublicWorks } from "../lib/contentSource";

export async function GET(context) {
  const [settings, works] = await Promise.all([getPublicSettings(), getPublicWorks()]);
  return rss({
    title: `${settings.authorName} — Latest works`,
    description: `New stories, books and essays by ${settings.authorName}.`,
    site: context.site,
    trailingSlash: true,
    items: works.map((work) => ({
      title: work.title,
      description: work.blurb,
      pubDate: new Date(work.publishedAt),
      link: `works/${work.slug}/`,
    })),
  });
}
