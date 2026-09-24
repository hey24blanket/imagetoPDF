import fs from "node:fs/promises";
import { messages } from "./src/i18n.js";
import { body } from "./src/template.js";
import { seoTopics, seoPageBody, guideHubBody } from "./src/seo-pages.js";

const origin = (process.env.SITE_URL || "https://imageto-pdf-eta.vercel.app").replace(/\/$/, "");
const langs = ["en", "ko"];
const buildDate = new Date().toISOString().slice(0, 10);

await fs.rm("dist", { recursive: true, force: true });
await fs.mkdir("dist/vendor", { recursive: true });
await fs.cp("src", "dist/src", { recursive: true });

for (const [from, to] of [
  ["node_modules/pdf-lib/dist/pdf-lib.min.js", "pdf-lib.min.js"],
  ["node_modules/pdfjs-dist/build/pdf.mjs", "pdf.mjs"],
  ["node_modules/pdfjs-dist/build/pdf.worker.mjs", "pdf.worker.mjs"],
  ["node_modules/pdfjs-dist/cmaps", "cmaps"],
  ["node_modules/pdfjs-dist/standard_fonts", "standard_fonts"],
]) {
  await fs.cp(from, `dist/vendor/${to}`, { recursive: true });
}

await fs.cp("public", "dist", { recursive: true });

function commonHead({ lang, title, description, canonical, alternates, type = "website", schema }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#edf5f8">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="${canonical}">
${alternates}
<meta property="og:type" content="${type}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${lang === "ko" ? "ko_KR" : "en_US"}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<link rel="stylesheet" href="/src/style.css">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script>
<script defer src="/_vercel/insights/script.js"></script>`;
}

function mainAlternates() {
  return `<link rel="alternate" hreflang="ko" href="${origin}/ko/">
<link rel="alternate" hreflang="en" href="${origin}/en/">
<link rel="alternate" hreflang="x-default" href="${origin}/">`;
}

function localizedAlternates(path) {
  return `<link rel="alternate" hreflang="ko" href="${origin}/ko/${path}">
<link rel="alternate" hreflang="en" href="${origin}/en/${path}">
<link rel="alternate" hreflang="x-default" href="${origin}/en/${path}">`;
}

for (const lang of langs) {
  const t = messages[lang];
  await fs.mkdir(`dist/${lang}`, { recursive: true });

  const appCanonical = `${origin}/${lang}/`;
  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Image to PDF",
    url: appCanonical,
    description: t.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    inLanguage: lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const appHtml = `<!doctype html><html lang="${lang}"><head>${commonHead({
    lang,
    title: t.title,
    description: t.description,
    canonical: appCanonical,
    alternates: mainAlternates(),
    schema: appSchema,
  })}
<script defer src="/vendor/pdf-lib.min.js"></script>
<script type="module" src="/src/app.js"></script>
</head><body>${body(t, lang)}</body></html>`;

  await fs.writeFile(`dist/${lang}/index.html`, appHtml);

  await fs.mkdir(`dist/${lang}/guides`, { recursive: true });
  const hubTitle = lang === "ko"
    ? "이미지 PDF·인쇄 가이드 | Image to PDF"
    : "Image PDF & Printing Guides | Image to PDF";
  const hubDescription = lang === "ko"
    ? "이미지 PDF 변환, 여러 이미지 한 장 배치, 색칠공부 인쇄, A4 2분할 인쇄를 위한 실용 가이드."
    : "Practical guides for combining images into PDFs, putting multiple images on one sheet, printing coloring pages and two-up A4 or Letter layouts.";
  const hubCanonical = `${origin}/${lang}/guides/`;
  const hubSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hubTitle,
    url: hubCanonical,
    description: hubDescription,
    inLanguage: lang,
    isPartOf: { "@type": "WebSite", name: "Image to PDF", url: `${origin}/${lang}/` },
  };
  const hubHtml = `<!doctype html><html lang="${lang}"><head>${commonHead({
    lang,
    title: hubTitle,
    description: hubDescription,
    canonical: hubCanonical,
    alternates: localizedAlternates("guides/"),
    schema: hubSchema,
  })}</head><body>${guideHubBody(lang)}</body></html>`;
  await fs.writeFile(`dist/${lang}/guides/index.html`, hubHtml);

  for (const topic of seoTopics) {
    const p = topic[lang];
    const dir = `dist/${lang}/${topic.slug}`;
    await fs.mkdir(dir, { recursive: true });
    const canonical = `${origin}/${lang}/${topic.slug}/`;
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          name: p.h1,
          url: canonical,
          description: p.description,
          inLanguage: lang,
          isPartOf: { "@type": "WebSite", name: "Image to PDF", url: `${origin}/${lang}/` },
          about: { "@type": "SoftwareApplication", name: "Image to PDF", applicationCategory: "UtilitiesApplication" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Image to PDF", item: `${origin}/${lang}/` },
            { "@type": "ListItem", position: 2, name: lang === "ko" ? "가이드" : "Guides", item: `${origin}/${lang}/guides/` },
            { "@type": "ListItem", position: 3, name: p.h1, item: canonical },
          ],
        },
      ],
    };

    const html = `<!doctype html><html lang="${lang}"><head>${commonHead({
      lang,
      title: p.title,
      description: p.description,
      canonical,
      alternates: localizedAlternates(`${topic.slug}/`),
      type: "article",
      schema,
    })}</head><body>${seoPageBody(topic, lang)}</body></html>`;

    await fs.writeFile(`${dir}/index.html`, html);
  }
}

const sitemapEntries = [];
for (const lang of langs) {
  sitemapEntries.push({
    loc: `${origin}/${lang}/`,
    path: "",
    xDefault: `${origin}/`,
  });
  sitemapEntries.push({
    loc: `${origin}/${lang}/guides/`,
    path: "guides/",
    xDefault: `${origin}/en/guides/`,
  });
  for (const topic of seoTopics) {
    sitemapEntries.push({
      loc: `${origin}/${lang}/${topic.slug}/`,
      path: `${topic.slug}/`,
      xDefault: `${origin}/en/${topic.slug}/`,
    });
  }
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.map(entry => `<url>
<loc>${entry.loc}</loc>
<lastmod>${buildDate}</lastmod>
<xhtml:link rel="alternate" hreflang="en" href="${origin}/en/${entry.path}"/>
<xhtml:link rel="alternate" hreflang="ko" href="${origin}/ko/${entry.path}"/>
<xhtml:link rel="alternate" hreflang="x-default" href="${entry.xDefault}"/>
</url>`).join("")}
</urlset>`;

await fs.writeFile("dist/robots.txt", `User-agent: *
Allow: /
Sitemap: ${origin}/sitemap.xml
`);
await fs.writeFile("dist/sitemap.xml", sitemapXml);

console.log(`Built ${langs.length} app locales, ${langs.length} guide hubs and ${seoTopics.length * langs.length} SEO guide pages.`);
