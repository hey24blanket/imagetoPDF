# Image to PDF
Responsive Korean/English print composer for coloring pages, worksheets and images. Images and PDFs stay in the browser. Output is built with pdf-lib; PDF source vectors are embedded rather than rasterized. PDF.js supplies thumbnail previews.

## Develop
`npm ci` then `npm run build`. Serve `dist/` to preview `/en/` and `/ko/`. Vercel serves `/` through `api/locale.js`, which selects the saved cookie, then Korean for KR or English otherwise. Explicit locale URLs are never geo-redirected. Set SITE_URL when changing the canonical domain.

## Features
1/2/4-up, A4/Letter, margins/gaps in mm, fit/crop, clockwise rotation, pointer drag + accessible reorder buttons, per-image/set repeats, optional empty-slot fill and cut guides. Separate prepare/share gesture supports mobile transient activation. Limits: 80 input pages, 30 MB/file, 150 MB/session, 200 output sheets. Large images normalize to at most 18 MP and 5000 px along either edge. Reload clears files.

## SEO
Both locales are prerendered HTML with useful coloring-print instructions and FAQs, reciprocal hreflang, canonical URLs, WebApplication structured data, sitemap and robots. Submit the sitemap to Google Search Console and Naver Search Advisor after account ownership verification; no indexing or ranking is guaranteed.

## Analytics
Vercel Web Analytics script plus `core_action` events after PDF download or successful share. Never includes file names or document contents. Enable Web Analytics in the Vercel project.
