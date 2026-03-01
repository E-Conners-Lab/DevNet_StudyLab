// ---------------------------------------------------------------------------
// Canonical Domain Data — DevNet Associate 200-901 Exam
// ---------------------------------------------------------------------------
//
// Single source of truth for the six exam domains. Every other module
// derives its domain lists from this array. When Cisco updates the exam
// blueprint, edit ONLY this file.
// ---------------------------------------------------------------------------

export interface DevNetDomain {
  /** 1-based domain number matching the exam blueprint */
  number: number;
  /** URL-safe slug used in routes and API calls */
  slug: string;
  /** Full official domain name */
  name: string;
  /** Shortened name for tight UI spaces (tabs, badges) */
  shortName: string;
  /** Exam weight percentage */
  weight: number;
}

export const DEVNET_DOMAINS: readonly DevNetDomain[] = [
  { number: 1, slug: "software-dev",             name: "Software Development & Design",      shortName: "Software Dev",    weight: 15 },
  { number: 2, slug: "apis",                     name: "Understanding & Using APIs",          shortName: "APIs",            weight: 20 },
  { number: 3, slug: "cisco-platforms",           name: "Cisco Platforms & Development",       shortName: "Cisco Platforms", weight: 15 },
  { number: 4, slug: "deployment-security",       name: "Application Deployment & Security",   shortName: "Deployment",      weight: 15 },
  { number: 5, slug: "infrastructure-automation", name: "Infrastructure & Automation",          shortName: "Infrastructure",  weight: 20 },
  { number: 6, slug: "network-fundamentals",      name: "Network Fundamentals",                shortName: "Networking",      weight: 15 },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDomainBySlug(slug: string | null): DevNetDomain | undefined {
  if (!slug) return undefined;
  return DEVNET_DOMAINS.find((d) => d.slug === slug);
}

export function getDomainByNumber(num: number | null): DevNetDomain | undefined {
  if (num == null) return undefined;
  return DEVNET_DOMAINS.find((d) => d.number === num);
}

export function domainSlugToNumber(slug: string | null): number | null {
  return getDomainBySlug(slug)?.number ?? null;
}

export function domainNumberToSlug(num: number | null): string | null {
  return getDomainByNumber(num)?.slug ?? null;
}

// ---------------------------------------------------------------------------
// Derived formats for common UI patterns
// ---------------------------------------------------------------------------

/** For Select/dropdown components: { value, label } */
export function getDomainSelectOptions(includeAll = true) {
  const options = DEVNET_DOMAINS.map((d) => ({
    value: d.slug,
    label: `${d.number}. ${d.name}`,
  }));
  return includeAll
    ? [{ value: "all", label: "All Domains" }, ...options]
    : options;
}

/** For Tab components: { slug, label, short } */
export function getDomainTabItems(includeAll = true) {
  const tabs = DEVNET_DOMAINS.map((d) => ({
    slug: d.slug,
    label: `${d.number}. ${d.shortName}`,
    short: `D${d.number}`,
  }));
  return includeAll
    ? [{ slug: "all", label: "All Domains", short: "All" }, ...tabs]
    : tabs;
}

// ---------------------------------------------------------------------------
// Mappings used by server-side data loaders
// ---------------------------------------------------------------------------

/** Slug → study-guide JSON filename */
export const SLUG_TO_STUDY_FILE: Record<string, string> = Object.fromEntries(
  DEVNET_DOMAINS.map((d) => [d.slug, `domain-${d.number}-${d.slug}.json`]),
);

/** Domain number → slug (used by flashcard file loader) */
export const NUMBER_TO_SLUG: Record<number, string> = Object.fromEntries(
  DEVNET_DOMAINS.map((d) => [d.number, d.slug]),
);
