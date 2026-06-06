/**
 * Portable headless SEO client — SSOT: modouls/_shared/frontend/seo/externalSiteSeo.ts
 * Документация: markbase.ru/docs/2026api/SEO/01_EXTERNAL_SITE_HEADLESS_INTEGRATION.md
 */

import {
  mergeSeoLayers,
  robotsToDirective,
  type SeoFieldLayer,
} from './mergeSeoLayer';

export type ExternalSeoConfig = {
  apiBase: string;
  projectSlug: string;
  apiKey?: string;
  companyId?: string;
  timeoutMs?: number;
  revalidateSec?: number;
};

export type CoreResolvePayload = {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  robots?: { noindex?: boolean; nofollow?: boolean };
  og?: { title?: string; description?: string; image?: string; type?: string };
  jsonLd?: string;
};

export type EffectivePageSeo = {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  robots?: string;
  og: { title: string; description: string; image?: string; type?: string };
  jsonLd?: string;
};

function layerFromCore(data: CoreResolvePayload | null | undefined): SeoFieldLayer | null {
  if (!data) return null;
  return {
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    canonical: data.canonical,
    robots: data.robots,
    og: data.og,
    jsonLd: data.jsonLd,
  };
}

export async function resolveSeoFromCore(
  config: ExternalSeoConfig,
  path: string,
): Promise<CoreResolvePayload | null> {
  const base = config.apiBase.replace(/\/+$/, '');
  const slug = config.projectSlug.trim();
  if (!base || !slug) return null;

  const url = new URL(`/api/seo/v1/public/${encodeURIComponent(slug)}/resolve`, base);
  url.searchParams.set('path', path.startsWith('/') ? path : `/${path}`);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers['X-Api-Key'] = config.apiKey;
  if (config.companyId) headers['X-Company-Id'] = config.companyId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);

  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: CoreResolvePayload };
    return json?.success && json.data ? json.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function buildEffectivePageSeo(input: {
  path: string;
  local?: SeoFieldLayer | null;
  core?: SeoFieldLayer | null;
  defaults?: SeoFieldLayer | null;
  entity?: SeoFieldLayer | null;
  siteName?: string;
  baseUrl?: string;
}): EffectivePageSeo {
  const merged = mergeSeoLayers({
    local: input.local,
    entity: input.entity,
    core: input.core,
    defaults: input.defaults,
  });

  const norm = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const base = (input.baseUrl || '').replace(/\/+$/, '');
  const computedCanonical = base ? `${base}${norm === '/' ? '' : norm}` : undefined;

  const title = merged.title || input.siteName || 'Site';
  const description = merged.description || '';
  const og = merged.og || {};

  return {
    title,
    description,
    keywords: merged.keywords,
    canonical: merged.canonical || computedCanonical,
    robots: robotsToDirective(merged.robots),
    og: {
      title: og.title || title,
      description: og.description || description,
      image: og.image,
      type: og.type || 'website',
    },
    jsonLd: merged.jsonLd,
  };
}

export async function resolveEffectivePageSeo(
  config: ExternalSeoConfig,
  input: {
    path: string;
    local?: SeoFieldLayer | null;
    defaults?: SeoFieldLayer | null;
    entity?: SeoFieldLayer | null;
    siteName?: string;
    baseUrl?: string;
    fetchCore?: boolean;
  },
): Promise<EffectivePageSeo> {
  const coreData =
    input.fetchCore !== false ? await resolveSeoFromCore(config, input.path) : null;
  return buildEffectivePageSeo({
    ...input,
    core: layerFromCore(coreData),
  });
}

/** Env → config (server-side only). */
export function seoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ExternalSeoConfig | null {
  const apiBase = String(env.MARKBASE_SEO_URL || '').trim();
  const projectSlug = String(env.MARKBASE_SEO_SLUG || env.MARKBASE_SEO_PROJECT_SLUG || '').trim();
  if (!apiBase || !projectSlug) return null;
  return {
    apiBase,
    projectSlug,
    apiKey: env.MARKBASE_SEO_API_KEY?.startsWith('REPLACE_WITH_')
      ? undefined
      : env.MARKBASE_SEO_API_KEY,
    companyId: env.MARKBASE_COMPANY_ID,
    revalidateSec: 300,
  };
}
