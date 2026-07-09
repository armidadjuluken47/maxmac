/**
 * Adapter for data imported from africanmeccasafaris.com (see scripts/import-africanmecca.mjs).
 */
import type { PackageItem } from '../data/packages';
import type { TaxonomyTerm } from './wte';
import { resolvePackageImage, sanitizeImageUrl } from './images';
import amsRaw from '../data/africanmecca-import.json';

export interface AmsDestination extends TaxonomyTerm {
  blurb?: string;
  image?: string;
  sourceUrl?: string;
  source?: string;
}

export interface AmsImport {
  importedAt: string;
  source: string;
  packages: (PackageItem & { sourceUrl?: string; source?: string })[];
  destinations: AmsDestination[];
}

const data = amsRaw as AmsImport;

const GRADIENTS: Record<string, [string, string]> = {
  Kenya: ['#c98a3c', '#6e4a22'],
  Tanzania: ['#c98a3c', '#7a4a1e'],
  Uganda: ['#4a9d7a', '#256149'],
  Rwanda: ['#5b7fa6', '#2c4a63'],
  Botswana: ['#b98a52', '#5e3d1c'],
  'South Africa': ['#5b7fa6', '#2c4a63'],
  Zambia: ['#7a9a5b', '#3d5a2c'],
  Zanzibar: ['#3fa9c9', '#1c6f86'],
  'East Africa': ['#c98a3c', '#7a4a1e'],
};

const FALLBACK_GRADIENTS: [string, string][] = [
  ['#c98a3c', '#7a4a1e'],
  ['#3fa9c9', '#1c6f86'],
  ['#5b7fa6', '#2c4a63'],
  ['#4a9d7a', '#256149'],
];

/** Imported safari packages from AfricanMecca. */
export function getAmsPackages(): PackageItem[] {
  return data.packages.map((p, i) => {
    const base: PackageItem = {
      ...p,
      image: sanitizeImageUrl(p.image),
      imageCard: sanitizeImageUrl(p.imageCard),
      gradient: GRADIENTS[p.dest] ?? GRADIENTS[p.region] ?? FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length],
      tripTypes: p.tripTypes ?? [],
    };
    return {
      ...base,
      image: resolvePackageImage(base, 'hero'),
      imageCard: resolvePackageImage(base, 'card'),
    };
  });
}

/** Imported destination guides from AfricanMecca. */
export function getAmsDestinations(): AmsDestination[] {
  return data.destinations;
}

export function getAmsImportMeta() {
  return { importedAt: data.importedAt, source: data.source, packageCount: data.packages.length };
}
