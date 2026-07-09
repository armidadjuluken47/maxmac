/**
 * Image helpers — reject scraper junk (social icons, logos) and fall back to
 * curated local assets when a package or taxonomy term has no usable photo.
 */

const JUNK_IMAGE =
  /(?:facebook|twitter|instagram|logo|fivestarams|redheartnew|pinterest|youtube|whatsapp|linkedin|tiktok|favicon|icon-|generalsmall|safariplanning|independentseal|\.gif(?:\?|$)|\.svg(?:\?|$))/i;

export function isUsableImageUrl(url?: string | null): url is string {
  if (!url?.trim()) return false;
  if (JUNK_IMAGE.test(url)) return false;
  return url.startsWith('/') || /^https?:\/\//i.test(url);
}

export const SITE_IMAGES = {
  hero: '/images/hero-safari.jpg',
  packagesBanner: '/images/hero-safari.jpg',
  destinationsBanner: '/images/tanzania.jpg',
  experiencesBanner: '/images/wildlife-safari.jpg',
  tripTypesBanner: '/images/zanzibar.jpg',
  contactBanner: '/images/kenya.jpg',
  aboutHero: '/images/kenya.jpg',
  fallback: {
    safari: '/images/wildlife-safari.jpg',
    beach: '/images/beach-coast.jpg',
    trek: '/images/kilimanjaro.jpg',
    coast: '/images/coast.jpg',
  },
  destinations: {
    Tanzania: '/images/tanzania.jpg',
    Kenya: '/images/kenya.jpg',
    Zanzibar: '/images/zanzibar.jpg',
    'Kenyan Coast': '/images/coast.jpg',
    Uganda: '/images/wildlife-safari.jpg',
    Rwanda: '/images/wildlife-safari.jpg',
    Botswana: '/images/wildlife-safari.jpg',
    'South Africa': '/images/wildlife-safari.jpg',
    Zambia: '/images/wildlife-safari.jpg',
    'East Africa': '/images/tanzania.jpg',
  },
  experiences: {
    'Wildlife safari': '/images/wildlife-safari.jpg',
    'Beach & coast': '/images/beach-coast.jpg',
    Trekking: '/images/kilimanjaro.jpg',
    Cultural: '/images/zanzibar.jpg',
    Honeymoon: '/images/beach-coast.jpg',
    Family: '/images/wildlife-safari.jpg',
  },
  tiles: {
    Serengeti: '/images/tanzania.jpg',
    Zanzibar: '/images/zanzibar.jpg',
    Kilimanjaro: '/images/kilimanjaro.jpg',
    'Kenya Coast': '/images/coast.jpg',
    'Diani Beach': '/images/coast.jpg',
  },
  tripTypes: {
    Luxury: '/images/tanzania.jpg',
    Family: '/images/wildlife-safari.jpg',
    Honeymoon: '/images/beach-coast.jpg',
    Budget: '/images/kenya.jpg',
    Group: '/images/wildlife-safari.jpg',
    Private: '/images/tanzania.jpg',
  },
  team: {
    guide: '/images/kenya.jpg',
    designer: '/images/tanzania.jpg',
    mountain: '/images/kilimanjaro.jpg',
    guest: '/images/coast.jpg',
  },
} as const;

export function destinationImage(name: string): string {
  return SITE_IMAGES.destinations[name as keyof typeof SITE_IMAGES.destinations] ?? SITE_IMAGES.fallback.safari;
}

export function experienceImage(name: string): string {
  return SITE_IMAGES.experiences[name as keyof typeof SITE_IMAGES.experiences] ?? SITE_IMAGES.fallback.safari;
}

export function tripTypeImage(name: string): string {
  return SITE_IMAGES.tripTypes[name as keyof typeof SITE_IMAGES.tripTypes] ?? SITE_IMAGES.fallback.safari;
}

export function tileImage(name: string): string {
  return SITE_IMAGES.tiles[name as keyof typeof SITE_IMAGES.tiles] ?? destinationImage(name);
}

type PackageLike = {
  image?: string;
  imageCard?: string;
  dest?: string;
  region?: string;
  tag?: string;
  exps?: string[];
};

function packageFallback(pkg: PackageLike): string {
  if (pkg.exps?.includes('Beach & coast') || pkg.tag === 'Beach') return SITE_IMAGES.fallback.beach;
  if (pkg.exps?.includes('Trekking')) return SITE_IMAGES.fallback.trek;
  const dest = pkg.dest || pkg.region || '';
  if (dest.includes('Coast') || dest === 'Zanzibar') return SITE_IMAGES.fallback.coast;
  return destinationImage(dest);
}

/** Pick a display URL for package heroes and cards. */
export function resolvePackageImage(pkg: PackageLike, kind: 'hero' | 'card' = 'card'): string {
  const primary = kind === 'hero' ? pkg.image || pkg.imageCard : pkg.imageCard || pkg.image;
  return isUsableImageUrl(primary) ? primary : packageFallback(pkg);
}

export function sanitizeImageUrl(url?: string | null): string {
  return isUsableImageUrl(url) ? url : '';
}
