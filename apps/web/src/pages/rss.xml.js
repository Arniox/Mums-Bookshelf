import rss from "@astrojs/rss";
import { getPublicWorks } from "../lib/contentSource";

export async function GET(context) {
  const works = await getPublicWorks();
  return rss({
    title: "Eleanor Hart — Latest works",
    description: "New stories, books and essays by Eleanor Hart.",
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
