/**
 * Portable copy — SSOT: markbase.ru/modouls/_shared/frontend/seo/mergeSeoLayer.ts
 * Скопируйте в lib/markbase/seo/ внешнего сайта (Next, Node SSR, edge).
 */

export type SeoRobotsFlags = {
  noindex?: boolean;
  nofollow?: boolean;
};

export type SeoOgLayer = {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
};

export type SeoFieldLayer = {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  canonical?: string | null;
  robots?: SeoRobotsFlags | null;
  og?: SeoOgLayer | null;
  jsonLd?: string | null;
};

export type MergeSeoLayersInput = {
  local?: SeoFieldLayer | null;
  core?: SeoFieldLayer | null;
  defaults?: SeoFieldLayer | null;
  entity?: SeoFieldLayer | null;
};

function pickString(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickRobots(...layers: Array<SeoRobotsFlags | null | undefined>): SeoRobotsFlags | undefined {
  for (const layer of layers) {
    if (layer && (layer.noindex !== undefined || layer.nofollow !== undefined)) {
      return layer;
    }
  }
  return undefined;
}

function pickOg(...layers: Array<SeoOgLayer | null | undefined>): SeoOgLayer | undefined {
  const merged: SeoOgLayer = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.title) merged.title = layer.title;
    if (layer.description) merged.description = layer.description;
    if (layer.image) merged.image = layer.image;
    if (layer.type) merged.type = layer.type;
  }
  return Object.keys(merged).length ? merged : undefined;
}

/** local ?? entity ?? core ?? defaults */
export function mergeSeoLayers(input: MergeSeoLayersInput): SeoFieldLayer {
  const { local, entity, core, defaults } = input;
  const order = [local, entity, core, defaults];

  return {
    title: pickString(...order.map((l) => l?.title)),
    description: pickString(...order.map((l) => l?.description)),
    keywords: pickString(...order.map((l) => l?.keywords)),
    canonical: pickString(...order.map((l) => l?.canonical)),
    robots: pickRobots(...order.map((l) => l?.robots)),
    og: pickOg(...order.map((l) => l?.og)),
    jsonLd: pickString(...order.map((l) => l?.jsonLd)),
  };
}

export function robotsToDirective(robots?: SeoRobotsFlags | null): string | undefined {
  if (!robots) return undefined;
  const index = robots.noindex ? 'noindex' : 'index';
  const follow = robots.nofollow ? 'nofollow' : 'follow';
  return `${index},${follow}`;
}
