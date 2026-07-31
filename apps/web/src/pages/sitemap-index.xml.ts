import { getPublicWorks } from "../lib/contentSource";

export async function GET({ site }: { site: URL }) {
  const works = await getPublicWorks();
  const urls = [
    "",
    "works/",
    "about/",
    ...works.map((work) => `works/${work.slug}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join("\n")}
</urlset>`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
