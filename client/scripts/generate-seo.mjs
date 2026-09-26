import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const clientRoot = fileURLToPath(new URL('../', import.meta.url));
const outputDir = join(clientRoot, 'dist');
const htmlPath = join(outputDir, 'index.html');
const fileEnv = loadEnv('production', clientRoot, '');
const rawSiteUrl = process.env.VITE_SITE_URL
  || fileEnv.VITE_SITE_URL
  || process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL
  || fileEnv.VITE_VERCEL_PROJECT_PRODUCTION_URL
  || process.env.VERCEL_PROJECT_PRODUCTION_URL
  || fileEnv.VERCEL_PROJECT_PRODUCTION_URL
  || 'https://omnichatinbox.chat';

function getCanonicalOrigin(value) {
  if (!value.trim()) return '';
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('VITE_SITE_URL must be an HTTPS origin, such as https://omniinbox.example.com.');
  }
  return url.origin;
}

const siteOrigin = getCanonicalOrigin(rawSiteUrl);
let html = await readFile(htmlPath, 'utf8');

if (siteOrigin) {
  html = html.replaceAll('__OMNIINBOX_URL__', siteOrigin);
} else {
  html = html
    .replace(/\s*<link rel="canonical" href="__OMNIINBOX_URL__\/"\s*\/>/g, '')
    .replace(/\s*<meta property="og:url" content="__OMNIINBOX_URL__\/"\s*\/>/g, '')
    .replace(/\s*<meta property="og:image" content="__OMNIINBOX_URL__\/og-image\.svg"\s*\/>/g, '')
    .replace(/\s*<meta property="og:image:alt"[^>]*\/>/g, '')
    .replace(/\s*<meta property="og:image:(?:type|width|height)"[^>]*\/>/g, '')
    .replace(/\s*<meta name="twitter:image" content="__OMNIINBOX_URL__\/og-image\.svg"\s*\/>/g, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
}

await writeFile(htmlPath, html);
await mkdir(outputDir, { recursive: true });
const robots = ['User-agent: *', 'Allow: /', ...(siteOrigin ? [`Sitemap: ${siteOrigin}/sitemap.xml`] : []), ''].join('\n');
await writeFile(join(outputDir, 'robots.txt'), robots);

const sitemapPath = join(outputDir, 'sitemap.xml');
if (siteOrigin) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteOrigin}/</loc></url></urlset>\n`;
  await writeFile(sitemapPath, sitemap);
  console.log(`Generated robots.txt and sitemap.xml for ${siteOrigin}`);
} else {
  await rm(sitemapPath, { force: true });
  console.warn('No canonical site URL found. Set VITE_SITE_URL to generate canonical metadata and sitemap.xml.');
}
