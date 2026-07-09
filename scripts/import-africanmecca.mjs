#!/usr/bin/env node
/**
 * Import safari packages and destination guides from africanmeccasafaris.com
 *
 * Usage:
 *   node scripts/import-africanmecca.mjs
 *   node scripts/import-africanmecca.mjs --countries kenya,tanzania
 *   node scripts/import-africanmecca.mjs --types=beach
 *   node scripts/import-africanmecca.mjs --refresh-images
 *
 * Output: frontend/src/data/africanmecca-import.json
 *
 * Note: Respect AfricanMecca's terms of use. This tool is for one-time catalog
 * migration/reference — do not hammer their servers (built-in rate limiting).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://www.africanmeccasafaris.com';
const UA = 'Mozilla/5.0 (compatible; MaxMacImporter/1.0)';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../frontend/src/data/africanmecca-import.json');

const DESTINATION_SLUGS = [
  'tanzania',
  'kenya',
  'uganda',
  'rwanda',
  'botswana',
  'south-africa',
  'zambia',
  'zanzibar',
];

const COUNTRY_LABELS = {
  kenya: 'Kenya',
  tanzania: 'Tanzania',
  uganda: 'Uganda',
  rwanda: 'Rwanda',
  botswana: 'Botswana',
  'south-africa': 'South Africa',
  zambia: 'Zambia',
  zanzibar: 'Zanzibar',
  eastern: 'East Africa',
};

/** Official titles from the AMS country index pages (e.g. /prices/safari/kenya). */
const PACKAGE_TITLE_OVERRIDES = {
  'kenya/ultimate-kenya-tour': '15 Days - Ultimate Kenya Safari',
  'kenya/best-of-kenya-tour': '12 Days - Best Of Kenya Safari',
  'kenya/north-kenya-mara-tour': '11 Days - Northern Kenya & Masai Mara Safari',
  'kenya/highlights-of-kenya-tour': '11 Days - Highlights Of Kenya Safari',
  'kenya/kenya-land-of-contrasts-tour': '10 Days - Kenya Land Of Contrasts Safari',
  'kenya/southern-kenya-tour': '9 Days - Southern Kenya Safari',
  'kenya/active-adventure-tour': '8 Days - Active Adventure Kenya Safari',
  'kenya/kenya-lakes-valleys-plains-tour': '7 Days - Kenya Lakes, Valleys & Plains Safari',
  'kenya/elephants-amboseli-cats-masaimara':
    '7 Days - Kilimanjaro Elephants Of Amboseli & Cats Of Masai Mara Safari',
  'kenya/best-of-masai-mara-tour': '5 Days - Best Of Masai Mara Safari',
  'kenya/laikipia': '4 Days - Laikipia Safari From Nairobi',
  'kenya/northern-frontier': '4 Days - Northern Frontier Safari From Nairobi',
  'kenya/masai-mara': '3 Days - Masai Mara Safari From Nairobi',
  'kenya/amboseli': '3 Days - Amboseli Safari From Nairobi',
  'kenya/chyulu-hills': '3 Days - Chyulu Safari From Nairobi',
  'kenya/samburu': '3 Days - Samburu Safari From Nairobi',
  'kenya/tsavo-west': '3 Days - Tsavo West Safari From Nairobi',
  'kenya/mombasa': '2 & 3 Days - Tsavo East Safaris From Mombasa',
  'tanzania/best-of-tanzania-tour': '13 Days - Best Of Tanzania Safari',
  'tanzania/fly-north-mobile-migration': '10 Days - Flying Northern Tanzania & Mobile Migration Safari',
  'tanzania/northern-migrations-explorations-tour': '10 Days - Northern Tanzania Migrations & Explorations Safari',
  'tanzania/beauty-north-tour': '9 Days - Beauty Of Northern Tanzania Safari',
  'tanzania/incredible-tour': '9 Days - Incredible Northern Tanzania Safari',
  'tanzania/showcasing-tanzania-tour': '9 Days - Showcasing Tanzania Safari',
  'tanzania/best-of-ngorongoro-serengeti-tour': '8 Days - Best Of Ngorongoro & Serengeti Safari',
  'tanzania/parks-private-conservancy-tour': '8 Days - Best Of Tanzania Parks & Private Conservancy Safari',
  'tanzania/classic-north-tour': '8 Days - Classic Northern Tanzania Safari',
  'tanzania/katavi-mahale-tour': '8 Days - Katavi Wildlife & Mahale Chimpanzee Safari',
  'tanzania/best-south-tour': '7 Days - Best Of Southern Tanzania Safari',
  'tanzania/gems-north-tour': '7 Days - Gems Of Northern Tanzania Safari',
  'tanzania/serengeti-migration-tour': '6 Days - Best Serengeti Migration & Private Conservancy Safari',
  'tanzania/explore-ngorongoro-serengeti': '6 Days - Explore Ngorongoro Crater & Serengeti Migration Safari',
  'tanzania/glimpses-north-tour': '6 Days - Glimpses Of Northern Tanzania Safari',
  'tanzania/highlights-north-tour': '5 Days - Highlights Of Northern Tanzania Safari',
  'tanzania/ngorongoro-serengeti-escape': '5 Days - Ngorongoro & Serengeti Migration Escape Safari',
  'tanzania/valley-crater-tour': '5 Days - Tanzania Valley & Crater Safari',
  'tanzania/serengeti-dar-znz': '4 Days - Serengeti Adventure Safari From Dar Es Salaam Or Zanzibar',
  'tanzania/mahale-chimp-tour': '4 & 5 Days - Mahale Chimpanzee Safari',
  'tanzania/gombe-chimp-tour': '4 Days - Gombe Chimpanzee Safari',
  'tanzania/ruaha-adventure-tour': '3 & 4 Days - Ruaha Adventure & Explorer Safari',
  'tanzania/nyerere-selous-tour': '3 & 4 Days - Nyerere (Selous) Adventure & Explorer Safari',
  'tanzania/serengeti-tour': '3 Days - Serengeti Explorer Safari From Arusha',
  'tanzania/ngorongoro-tour': '3 Days - Ngorongoro Safari From Arusha',
  'tanzania/tarangire-tour': '3 Days - Tarangire Safari From Arusha',
  'tanzania/manyara-tour': '3 Days - Lake Manyara Safari From Arusha',
  'tanzania/arusha-kilimanjaro-park-tour': '3 Days - Arusha Park & Kilimanjaro Safari',
};

/** Listed on the Kenya index but hosted under travel-guide, not /prices/safari/. */
const SUPPLEMENTAL_PACKAGES = [
  {
    slug: 'ams-kenya-meru',
    category: 'safari',
    name: '4 Days - Meru Safari From Nairobi',
    region: 'Kenya',
    dest: 'Kenya',
    tag: 'Safari',
    days: 4,
    priceN: 2595,
    currency: 'USD',
    rating: 4.8,
    image: '',
    imageCard: '',
    imageAlt: '4 Days - Meru Safari From Nairobi',
    blurb: 'Meru National Park safari from Nairobi — Elsa\'s Kopje and the landscapes that inspired Born Free.',
    exps: ['Wildlife safari'],
    chips: ['Kenya', 'Meru'],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl:
      'https://www.africanmeccasafaris.com/travel-guide/kenya/accommodation/meru/elsas-kopje/trip-ideas',
    source: 'africanmeccasafaris.com',
  },
  {
    slug: 'ams-kenya-balloon-masai-mara',
    category: 'safari',
    name: 'Balloon Safari In Masai Mara',
    region: 'Kenya',
    dest: 'Kenya',
    tag: 'Safari',
    days: 1,
    priceN: 585,
    currency: 'USD',
    rating: 4.8,
    image: '',
    imageCard: '',
    imageAlt: 'Balloon Safari In Masai Mara',
    blurb: 'Sunrise hot-air balloon flight over the Masai Mara plains and river — champagne bush breakfast included.',
    exps: ['Wildlife safari'],
    chips: ['Kenya', 'Masai Mara'],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl:
      'https://www.africanmeccasafaris.com/travel-guide/kenya/parks-reserves/masai-mara/balloon-safari',
    source: 'africanmeccasafaris.com',
  },
  {
    slug: 'ams-tanzania-rubondo',
    category: 'safari',
    name: '4 Days - Rubondo Island - Lake Victoria & Chimp Adventure Safari',
    region: 'Tanzania',
    dest: 'Tanzania',
    tag: 'Safari',
    days: 4,
    priceN: 3860,
    currency: 'USD',
    rating: 4.8,
    image: '',
    imageCard: '',
    imageAlt: '4 Days - Rubondo Island - Lake Victoria & Chimp Adventure Safari',
    blurb:
      'Rubondo Island on Lake Victoria — chimp trekking, forest walks, and boat safaris on Africa\'s largest lake.',
    exps: ['Wildlife safari'],
    chips: ['Tanzania', 'Rubondo Island'],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl:
      'https://www.africanmeccasafaris.com/travel-guide/tanzania/accommodation/rubondo/rubondo-island-camp/trip-ideas',
    source: 'africanmeccasafaris.com',
  },
  {
    slug: 'ams-tanzania-lake-natron',
    category: 'safari',
    name: '4 Days - Lake Natron Maasai Culture & Adventure Safari',
    region: 'Tanzania',
    dest: 'Tanzania',
    tag: 'Safari',
    days: 4,
    priceN: 2510,
    currency: 'USD',
    rating: 4.8,
    image: '',
    imageCard: '',
    imageAlt: '4 Days - Lake Natron Maasai Culture & Adventure Safari',
    blurb:
      'Lake Natron beneath Ol Doinyo Lengai — flamingo colonies, Maasai cultural visits, and Rift Valley scenery.',
    exps: ['Wildlife safari'],
    chips: ['Tanzania', 'Lake Natron'],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl:
      'https://www.africanmeccasafaris.com/travel-guide/tanzania/accommodation/lake-natron/lake-natron-camp/trip-ideas',
    source: 'africanmeccasafaris.com',
  },
  {
    slug: 'ams-tanzania-balloon-serengeti',
    category: 'safari',
    name: 'Balloon Safari In Serengeti',
    region: 'Tanzania',
    dest: 'Tanzania',
    tag: 'Safari',
    days: 1,
    priceN: 599,
    currency: 'USD',
    rating: 4.8,
    image: '',
    imageCard: '',
    imageAlt: 'Balloon Safari In Serengeti',
    blurb:
      'Sunrise hot-air balloon over the Serengeti plains — wildlife from above and champagne bush breakfast.',
    exps: ['Wildlife safari'],
    chips: ['Tanzania', 'Serengeti'],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl:
      'https://www.africanmeccasafaris.com/travel-guide/tanzania/parks-reserves/serengeti/balloon-safari',
    source: 'africanmeccasafaris.com',
  },
];

const DEFAULT_INCLUDES = [
  'Professional safari guiding and park fees as listed in the itinerary.',
  'Accommodation in selected camps or lodges on the chosen tier.',
  'Meals as specified by each property (typically full board on safari).',
  'Ground transfers between parks and airstrips as per the route.',
  'Conservation and community levies where applicable.',
];

const DEFAULT_EXCLUDES = [
  'International flights and visa fees.',
  'Travel insurance and medical evacuation cover.',
  'Personal expenses, drinks, and laundry unless stated.',
  'Optional activities (balloon safaris, spa, etc.) unless included.',
  'Tips and gratuities for guides, drivers, and camp staff.',
];

/** Areas visited — from AMS Kenya index (fallback when tier page has no list). */
const KENYA_AREAS = {
  'ultimate-kenya-tour': ['Amboseli', 'Laikipia', 'Ol Pejeta', 'Great Rift Valley Lakes', 'Masai Mara'],
  'best-of-kenya-tour': ['Amboseli', 'Laikipia', 'Great Rift Valley Lakes', 'Masai Mara'],
  'north-kenya-mara-tour': ['Laikipia', 'Masai Mara'],
  'highlights-of-kenya-tour': ['Amboseli', 'Laikipia', 'Masai Mara'],
  'kenya-land-of-contrasts-tour': ['Laikipia', 'Great Rift Valley Lakes', 'Masai Mara'],
  'southern-kenya-tour': ['Amboseli', 'Great Rift Valley Lakes', 'Masai Mara'],
  'active-adventure-tour': ['Laikipia', 'Masai Mara'],
  'kenya-lakes-valleys-plains-tour': ['Great Rift Valley Lakes', 'Masai Mara'],
  'elephants-amboseli-cats-masaimara': ['Amboseli', 'Masai Mara'],
  'best-of-masai-mara-tour': ['Masai Mara'],
  laikipia: ['Laikipia Private Conservancies'],
  'northern-frontier': ['Northern Frontier', 'Namunyak', 'Matthews Mountain Forest'],
  'masai-mara': ['Masai Mara'],
  amboseli: ['Amboseli'],
  'chyulu-hills': ['Chyulu Hills'],
  samburu: ['Samburu'],
  'tsavo-west': ['Tsavo West'],
  mombasa: ['Tsavo East'],
  meru: ['Meru', "Elsa's Kopje"],
  'balloon-masai-mara': ['Masai Mara'],
};

/** Areas visited — from AMS Tanzania index (fallback when tier page has no list). */
const TANZANIA_AREAS = {
  'best-of-tanzania-tour': [
    'Arusha',
    'Tarangire',
    'Manyara',
    'Ngorongoro Crater',
    'Serengeti (Central & Migration Follow)',
    'Nyerere (Selous)',
  ],
  'fly-north-mobile-migration': [
    'Arusha',
    'Tarangire',
    'Ngorongoro',
    'Serengeti (Central & Mobile Migration Follow)',
  ],
  'northern-migrations-explorations-tour': [
    'Arusha',
    'Tarangire',
    'Manyara',
    'Ngorongoro',
    'Serengeti (Central & Migration Follow)',
  ],
  'beauty-north-tour': ['Arusha', 'Tarangire', 'Ngorongoro', 'Serengeti (Mobile Migration Follow)'],
  'incredible-tour': ['Arusha', 'Tarangire', 'Ngorongoro', 'Serengeti (Mobile Migration Follow)'],
  'showcasing-tanzania-tour': [
    'Arusha',
    'Lake Manyara',
    'Ngorongoro Crater',
    'Serengeti (Central & Migration Follow)',
  ],
  'best-of-ngorongoro-serengeti-tour': [
    'Arusha',
    'Ngorongoro Crater',
    'Serengeti (Central & Migration Follow)',
  ],
  'parks-private-conservancy-tour': ['Arusha', 'Manyara', 'Ngorongoro', 'Serengeti Private Conservancy'],
  'classic-north-tour': ['Arusha', 'Tarangire', 'Manyara', 'Ngorongoro', 'Serengeti (Central)'],
  'katavi-mahale-tour': ['Katavi', 'Mahale'],
  'best-south-tour': ['Nyerere (Selous)', 'Ruaha'],
  'gems-north-tour': ['Arusha', 'Manyara', 'Ngorongoro', 'Serengeti (Mobile Migration Follow)'],
  'serengeti-migration-tour': ['Serengeti Park (Mobile Migration)', 'Private Conservancy'],
  'explore-ngorongoro-serengeti': [
    'Arusha',
    'Manyara',
    'Ngorongoro',
    'Serengeti (Mobile Migration Follow)',
  ],
  'glimpses-north-tour': ['Arusha', 'Ngorongoro', 'Serengeti (Central)'],
  'highlights-north-tour': ['Arusha', 'Ngorongoro', 'Serengeti (Central)'],
  'ngorongoro-serengeti-escape': ['Arusha', 'Ngorongoro', 'Serengeti (Mobile Migration Follow)'],
  'valley-crater-tour': ['Arusha', 'Manyara', 'Ngorongoro'],
  'serengeti-dar-znz': ['Serengeti From Dar es Salaam Or Zanzibar'],
  rubondo: ['Rubondo Island (Lake Victoria)'],
  'lake-natron': ['Lake Natron'],
  'mahale-chimp-tour': ['Mahale', 'Kigoma (Optional)'],
  'gombe-chimp-tour': ['Gombe', 'Kigoma (Optional)'],
  'ruaha-adventure-tour': ['Ruaha From Serengeti, Dar es Salaam or Zanzibar'],
  'nyerere-selous-tour': ['Nyerere (Selous) From Serengeti, Dar es Salaam or Zanzibar'],
  'serengeti-tour': ['Serengeti From Arusha'],
  'ngorongoro-tour': ['Ngorongoro From Arusha'],
  'tarangire-tour': ['Tarangire From Arusha'],
  'manyara-tour': ['Lake Manyara From Arusha'],
  'arusha-kilimanjaro-park-tour': [
    'Arusha Park',
    'Mount Kilimanjaro Park (Private Conservancy - West)',
  ],
  'balloon-serengeti': ['Balloon Flight Over The Serengeti Plains'],
};

const args = process.argv.slice(2);
const countryFilter = args.find((a) => a.startsWith('--countries='))?.split('=')[1]?.split(',').filter(Boolean);
const typeFilter = args.find((a) => a.startsWith('--types='))?.split('=')[1]?.split(',').filter(Boolean) ?? ['safari', 'beach'];
const refreshImagesOnly = args.includes('--refresh-images');
const refreshContentOnly = args.includes('--refresh-content');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanPackageName(name, slug) {
  let n = name
    .replace(/\s+FOR\s+\d{4}.*$/i, '')
    .replace(/\s*\(\d{4}[-–]\d{4}\)\s*/g, '')
    .replace(/\s+PACKAGES?\s*&\s*PRICES?\s*COMPARISON.*$/i, '')
    .replace(/\s+VACATIONS?\s*&\s*TOUR\s+PRICES.*$/i, '')
    .replace(/\s+FROM\s+[A-Z][A-Za-z\s]+$/i, '')
    .replace(/\s+-\s+AVAILABLE IN.*$/i, '')
    .trim();

  if (!n || n.length > 80) {
    n = slug
      .replace(/-tour$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (n === n.toUpperCase() && n.length > 4) {
    n = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return n;
}

function stripTags(html = '') {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function packageSlugFromPkg(pkg) {
  return (pkg.slug ?? '').replace(/^ams-(?:beach-|safari-)?[^-]+-/, '');
}

function extractDestinationExperiences(html) {
  const m =
    html.match(/Destination Experiences[\s\S]*?<ol>([\s\S]*?)<\/ol>/i) ??
    html.match(/core destinations[\s\S]*?<ol>([\s\S]*?)<\/ol>/i);
  if (!m) return [];
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((x) => stripTags(x[1]))
    .filter((t) => t.length > 12);
}

function parseIncludesExcludes(html) {
  const includes = [];
  const inc = html.match(/What Is Included:<\/b>([\s\S]*?)(?:What Is Excluded|Other services)/i);
  if (inc) {
    for (const li of inc[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
      const t = stripTags(li[1]);
      if (t) includes.push(t);
    }
  }
  const excludes = [];
  const exc = html.match(/What Is Excluded:<\/b>([\s\S]*?)(?:Other services|$)/i);
  if (exc) {
    for (const li of exc[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
      const t = stripTags(li[1]);
      if (t) excludes.push(t);
    }
    if (!excludes.length) {
      const t = stripTags(exc[1]);
      if (t.length > 20) excludes.push(t);
    }
  }
  return { includes, excludes };
}

function buildItinerary(experiences, days, tripName) {
  const d = Math.max(1, days || experiences.length || 1);
  const itinerary = [];
  if (experiences.length) {
    for (let i = 0; i < d; i++) {
      const exp = experiences[i % experiences.length];
      const shortTitle = exp.split(' - ')[0].split('.')[0].slice(0, 72);
      itinerary.push({
        title: experiences.length >= d ? shortTitle : `Day ${i + 1}`,
        desc: exp,
      });
    }
  } else {
    for (let i = 1; i <= d; i++) {
      itinerary.push({
        title: `Day ${i}`,
        desc: `Continue your ${tripName} — expert-guided game drives and lodge stays.`,
      });
    }
  }
  return itinerary;
}

/** Fill highlights, itinerary, includes/excludes on a package record. */
function applyContentEnrichment(pkg, html = '') {
  const slug = packageSlugFromPkg(pkg);
  const isKenya = (pkg.slug ?? '').includes('ams-kenya-') || pkg.dest === 'Kenya';
  const isTanzania = (pkg.slug ?? '').includes('ams-tanzania-') || pkg.dest === 'Tanzania';

  const experiences = extractDestinationExperiences(html);
  let areas = isKenya ? KENYA_AREAS[slug] ?? [] : isTanzania ? TANZANIA_AREAS[slug] ?? [] : [];
  if (!areas.length && experiences.length) {
    areas = experiences.map((e) => e.split(' - ')[0].split('.')[0].trim().slice(0, 48));
  }

  const { includes, excludes } = parseIncludesExcludes(html);
  const highlights = experiences.length ? experiences : areas;

  pkg.areasVisited = areas;
  pkg.highlights = highlights;
  pkg.includes = includes.length ? includes : DEFAULT_INCLUDES;
  pkg.excludes = excludes.length ? excludes : DEFAULT_EXCLUDES;
  pkg.itinerary = buildItinerary(experiences.length ? experiences : areas, pkg.days, pkg.name);
  pkg.itineraryIntro = pkg.days
    ? `A ${pkg.days}-day journey across ${areas.length ? areas.join(', ') : pkg.region}.`
    : `Explore ${pkg.name} across ${pkg.region}.`;
  pkg.chips = [...new Set([pkg.dest, ...areas.slice(0, 4)])].filter(Boolean);
}

async function enrichPackageContent(pkg, parentHtml, parentUrl) {
  const parts = new URL(parentUrl).pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const country = parts[2] ?? '';
  const slug = parts[3] ?? '';
  let html = parentHtml;

  const tierUrl = parentUrl.replace(/\/$/, '') + '/tier-three-value';
  try {
    const tierRes = await fetch(tierUrl, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!tierRes.ok) throw new Error(`${tierUrl} -> ${tierRes.status}`);
    const tierHtml = await tierRes.text();
    const finalPath = new URL(tierRes.url).pathname;
    const isSameTrip = finalPath.includes(`/prices/safari/${country}/${slug}`) || finalPath.includes(`/${country}/${slug}/`);
    if (isSameTrip && (tierHtml.includes(slug) || tierHtml.includes('TIER 3') || tierHtml.includes('Tier 3'))) {
      html = tierHtml;
    }
  } catch {
    // tier page unavailable
  }

  applyContentEnrichment(pkg, html);
}

async function refreshContent() {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  const packages = existing.packages ?? [];
  console.log(`Refreshing WTE content for ${packages.length} packages…`);
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const url = pkg.sourceUrl;
    if (!url) continue;
    process.stdout.write(`\rContent ${i + 1}/${packages.length}: ${pkg.slug}          `);
    try {
      const parentHtml = await fetchText(url);
      await enrichPackageContent(pkg, parentHtml, url);
    } catch {
      applyContentEnrichment(pkg);
    }
    await sleep(400);
  }
  console.log('');
  existing.importedAt = new Date().toISOString();
  await writeFile(OUT, JSON.stringify(existing, null, 2) + '\n');
  console.log(`Wrote enriched content for ${packages.length} packages to ${OUT}`);
}

function decodeHtml(input = '') {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&#0?38;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const JUNK_IMAGE = /(?:facebook|twitter|instagram|logo|fivestarams|redheartnew|pinterest|youtube|whatsapp|linkedin|tiktok|favicon|icon-|generalsmall|safariplanning|independentseal|\.gif(?:\?|$)|\.svg(?:\?|$))/i;

/** Pick the first real photo from an AMS page (skip social icons and logos). */
function extractPageImage(html) {
  const urls = [
    ...html.matchAll(
      /(?:data-lazy-src|data-src|src|content)="(https:\/\/www\.africanmeccasafaris\.com\/wp-content\/uploads\/[^"]+\.(?:jpe?g|webp|png|gif))"/gi
    ),
  ]
    .map((m) => m[1])
    .filter((u) => !JUNK_IMAGE.test(u));

  const unique = [...new Set(urls)];
  const hero = unique.find((u) => !/small\d*\.(?:jpe?g|webp)/i.test(u));
  return hero || unique[0] || '';
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function fetchSitemapUrls() {
  const urls = new Set();
  for (let i = 1; i <= 4; i++) {
    const xml = await fetchText(`${BASE}/page-sitemap${i}.xml`);
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1]);
    await sleep(300);
  }
  return [...urls];
}

function isPackageUrl(url) {
  const parts = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (parts.length !== 4 || parts[0] !== 'prices') return false;
  const category = parts[1];
  if (!typeFilter.includes(category)) return false;
  if (category !== 'safari' && category !== 'beach') return false;
  const country = parts[2];
  const slug = parts[3];
  if (slug === 'specials-discounts' || slug === 'ultra-luxury') return false; // hub pages, not single itineraries
  if (countryFilter && !countryFilter.includes(country)) return false;
  return true;
}

function isDestinationUrl(url) {
  const parts = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 'travel-guide' && DESTINATION_SLUGS.includes(parts[1]);
}

function parsePackage(html, url) {
  const parts = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const category = parts[1]; // safari | beach
  const countrySlug = parts[2];
  const slug = parts[3];

  const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1] ?? '';
  const metaDesc = html.match(/name="description" content="([^"]+)"/)?.[1] ?? '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';

  const daysMatch =
    html.match(/(\d+)\s+DAYS?\s+ITINERARY/i) ??
    metaDesc.match(/(\d+)\s+Days?/i) ??
    ogTitle.match(/(\d+)\s+Days?/i);
  const days = daysMatch ? Number(daysMatch[1]) : 0;

  const prices = [...html.matchAll(/Prices from \$([\d,]+)/gi)].map((m) => Number(m[1].replace(/,/g, '')));
  const altPrices = [...html.matchAll(/\$([\d,]+)/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => n >= 1000);
  const priceN = prices.length ? Math.min(...prices) : altPrices.length ? Math.min(...altPrices) : 0;

  const image = extractPageImage(html);

  let name = cleanPackageName(decodeHtml(h1) || decodeHtml(ogTitle.split(' - ')[0]), slug);
  const titleKey = `${countrySlug}/${slug}`;
  if (PACKAGE_TITLE_OVERRIDES[titleKey]) name = PACKAGE_TITLE_OVERRIDES[titleKey];
  if (countrySlug === 'eastern' && slug === 'kenya-tanzania') name = 'Kenya & Tanzania Combined Safari';

  const beachDestOverrides = {
    'best-of-zanzibar': 'Zanzibar',
    'best-of-pemba': 'Zanzibar',
    'best-of-mafia': 'Zanzibar',
    'best-of-mombasa': 'Kenyan Coast',
  };

  const country =
    beachDestOverrides[slug] ??
    (countrySlug === 'eastern'
      ? 'East Africa'
      : COUNTRY_LABELS[countrySlug] ?? countrySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  const isBeach = category === 'beach';
  const pkgSlug = isBeach ? `ams-beach-${countrySlug}-${slug}` : `ams-${countrySlug}-${slug}`;

  return {
    slug: pkgSlug,
    category,
    name,
    region: country,
    dest: country,
    tag: isBeach ? 'Beach' : slug.includes('tour') ? 'Safari tour' : 'Safari',
    days,
    priceN,
    currency: 'USD',
    rating: 4.8,
    image,
    imageCard: image,
    imageAlt: name,
    blurb: decodeHtml(metaDesc)
      .replace(/^Detailed safari itinerary for \d+ Days? - /i, '')
      .replace(/^Detailed beach (?:itinerary|vacation) for \d+ Days? - /i, ''),
    exps: [isBeach ? 'Beach & coast' : 'Wildlife safari'],
    chips: [country],
    highlights: [],
    itinerary: [],
    includes: [],
    excludes: [],
    sourceUrl: url,
    source: 'africanmeccasafaris.com',
  };
}

function parseDestination(html, url) {
  const slug = new URL(url).pathname.replace(/\/$/, '').split('/').pop() ?? '';
  const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1] ?? '';
  const metaDesc = html.match(/name="description" content="([^"]+)"/)?.[1] ?? '';
  const image = extractPageImage(html);

  const name =
    COUNTRY_LABELS[slug] ??
    (decodeHtml(ogTitle.split('–')[0].split('-')[0]).replace(/Travel Guide.*/i, '').trim() ||
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  return {
    name,
    slug,
    count: 0,
    parent: 0,
    blurb: decodeHtml(metaDesc),
    image,
    sourceUrl: url,
    source: 'africanmeccasafaris.com',
  };
}

async function refreshImages() {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  const packages = existing.packages ?? [];
  console.log(`Refreshing images for ${packages.length} packages…`);
  let updated = 0;
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const url = pkg.sourceUrl;
    if (!url) continue;
    process.stdout.write(`\rImages ${i + 1}/${packages.length}: ${pkg.slug}          `);
    try {
      const html = await fetchText(url);
      const image = extractPageImage(html);
      if (image && image !== pkg.image) {
        pkg.image = image;
        pkg.imageCard = image;
        updated++;
      }
    } catch (e) {
      console.warn(`\nSkip ${url}: ${e.message}`);
    }
    await sleep(400);
  }
  console.log(`\nUpdated ${updated} package images`);
  existing.importedAt = new Date().toISOString();
  await writeFile(OUT, JSON.stringify(existing, null, 2) + '\n');
  console.log(`Wrote ${packages.length} packages to ${OUT}`);
}

async function main() {
  if (refreshImagesOnly) {
    await refreshImages();
    return;
  }
  if (refreshContentOnly) {
    await refreshContent();
    return;
  }

  console.log('Fetching sitemaps…');
  const allUrls = await fetchSitemapUrls();

  const packageUrls = allUrls.filter(isPackageUrl).sort();
  const destinationUrls = allUrls.filter(isDestinationUrl).sort();

  console.log(`Found ${packageUrls.length} package pages (${typeFilter.join('+')}), ${destinationUrls.length} destination guides`);

  const packages = [];
  for (let i = 0; i < packageUrls.length; i++) {
    const url = packageUrls[i];
    process.stdout.write(`\rPackages ${i + 1}/${packageUrls.length}: ${url.split('/').slice(-2).join('/')}          `);
    try {
      const html = await fetchText(url);
      const pkg = parsePackage(html, url);
      await enrichPackageContent(pkg, html, url);
      packages.push(pkg);
    } catch (e) {
      console.warn(`\nSkip ${url}: ${e.message}`);
    }
    await sleep(400);
  }
  console.log('');

  const destinations = [];
  for (let i = 0; i < destinationUrls.length; i++) {
    const url = destinationUrls[i];
    process.stdout.write(`\rDestinations ${i + 1}/${destinationUrls.length}: ${url.split('/').pop()}          `);
    try {
      const html = await fetchText(url);
      destinations.push(parseDestination(html, url));
    } catch (e) {
      console.warn(`\nSkip ${url}: ${e.message}`);
    }
    await sleep(400);
  }
  console.log('');

  // Merge with existing catalog when fetching a subset (e.g. --types=beach)
  let mergedPackages = packages;
  let mergedDestinations = destinations;
  try {
    const existing = JSON.parse(await readFile(OUT, 'utf8'));
    if (typeFilter.length < 2 || countryFilter) {
      const byUrl = new Map((existing.packages ?? []).map((p) => [p.sourceUrl, p]));
      for (const p of packages) byUrl.set(p.sourceUrl, p);
      mergedPackages = [...byUrl.values()].sort((a, b) => a.slug.localeCompare(b.slug));

      const destBySlug = new Map((existing.destinations ?? []).map((d) => [d.slug, d]));
      for (const d of destinations) destBySlug.set(d.slug, d);
      mergedDestinations = [...destBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
    }
  } catch {
    // no existing file — use fresh fetch only
  }

  const bySlug = new Map(mergedPackages.map((p) => [p.slug, p]));
  for (const sup of SUPPLEMENTAL_PACKAGES) {
    const existing = bySlug.get(sup.slug);
    if (existing) {
      // Supplemental entries may have been polluted by prior bad enrichment runs.
      // Rehydrate from the canonical supplemental definition on every import.
      Object.assign(existing, { ...sup });
      applyContentEnrichment(existing);
      continue;
    }
    const copy = { ...sup };
    applyContentEnrichment(copy);
    mergedPackages.push(copy);
    bySlug.set(copy.slug, copy);
  }
  mergedPackages.sort((a, b) => a.slug.localeCompare(b.slug));

  const counts = {};
  for (const p of mergedPackages) {
    const key = p.dest.toLowerCase().replace(/\s+/g, '-');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const d of mergedDestinations) {
    d.count = counts[d.slug] ?? mergedPackages.filter((p) => p.region === d.name || p.dest === d.name).length;
  }

  const output = {
    importedAt: new Date().toISOString(),
    source: BASE,
    packages: mergedPackages,
    destinations: mergedDestinations,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${mergedPackages.length} packages and ${mergedDestinations.length} destinations to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
