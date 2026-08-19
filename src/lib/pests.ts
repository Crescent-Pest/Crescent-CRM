/**
 * Pest catalog — the single source of truth for which pests the app knows.
 * Slugs map 1:1 to treatment docs in docs/pests/<slug>.md and to keys in
 * src/data/pricing.json. Keep all three in sync when adding a pest.
 * (general-inspection intentionally has no pricing entry — inspection only.)
 */

export interface PestInfo {
  slug: string;
  commonName: string;
  /** short label for buttons/badges */
  shortName: string;
}

export const PESTS: PestInfo[] = [
  { slug: "german-cockroach", commonName: "German Cockroach", shortName: "German Roach" },
  { slug: "american-cockroach", commonName: "American Cockroach", shortName: "American Roach" },
  { slug: "smokybrown-cockroach", commonName: "Smokybrown Cockroach (Palmetto Bug)", shortName: "Smokybrown Roach" },
  { slug: "subterranean-termite", commonName: "Eastern Subterranean Termite", shortName: "Subterranean Termite" },
  { slug: "formosan-termite", commonName: "Formosan Termite", shortName: "Formosan Termite" },
  { slug: "drywood-termite", commonName: "Drywood Termite", shortName: "Drywood Termite" },
  { slug: "ants", commonName: "Household Ants (Argentine / Odorous)", shortName: "Household Ants" },
  { slug: "fire-ants", commonName: "Fire Ants", shortName: "Fire Ants" },
  { slug: "carpenter-ants", commonName: "Carpenter Ants", shortName: "Carpenter Ants" },
  { slug: "rodents-mice", commonName: "Mice", shortName: "Mice" },
  { slug: "rodents-rats", commonName: "Rats", shortName: "Rats" },
  { slug: "spiders", commonName: "Spiders", shortName: "Spiders" },
  { slug: "bed-bugs", commonName: "Bed Bugs", shortName: "Bed Bugs" },
  { slug: "mosquitoes", commonName: "Mosquitoes", shortName: "Mosquitoes" },
  { slug: "fleas", commonName: "Fleas", shortName: "Fleas" },
  { slug: "wasps-hornets", commonName: "Wasps & Hornets", shortName: "Wasps/Hornets" },
  { slug: "carpenter-bees", commonName: "Carpenter Bees", shortName: "Carpenter Bees" },
  { slug: "silverfish", commonName: "Silverfish", shortName: "Silverfish" },
  { slug: "occasional-invaders", commonName: "Occasional Invaders (Millipedes, Centipedes, Earwigs)", shortName: "Occasional Invaders" },
  { slug: "general-inspection", commonName: "No Pest Identified / General Inspection", shortName: "General Inspection" },
];

export const PEST_SLUGS = PESTS.map((p) => p.slug);

export function isKnownPest(slug: string): boolean {
  return PESTS.some((p) => p.slug === slug);
}

export function pestBySlug(slug: string): PestInfo | undefined {
  return PESTS.find((p) => p.slug === slug);
}

/**
 * Map an AI candidate's common name to a catalog slug, best-effort.
 * Fallback for candidates missing a valid slug (older saved rows, or the
 * model naming a species off-catalog). Order matters: specific names must
 * match before generic ones ("fire ant" before "ant").
 */
export function slugFromCommonName(name: string): string | null {
  const n = name.toLowerCase();
  // roaches — specific species before the generic fallthrough
  if (n.includes("german") && (n.includes("roach") || n.includes("cockroach")))
    return "german-cockroach";
  if (n.includes("smokybrown") || n.includes("smoky brown") || n.includes("smoky-brown"))
    return "smokybrown-cockroach";
  // Charleston's "palmetto bug" is usually a smokybrown
  if (n.includes("palmetto")) return "smokybrown-cockroach";
  if (n.includes("cockroach") || n.includes("roach")) return "american-cockroach";
  // termites — species before generic
  if (n.includes("formosan")) return "formosan-termite";
  if (n.includes("drywood")) return "drywood-termite";
  if (n.includes("termite")) return "subterranean-termite";
  // ants — specific before generic
  if (n.includes("fire ant")) return "fire-ants";
  if (n.includes("carpenter ant")) return "carpenter-ants";
  if (n.includes("carpenter bee")) return "carpenter-bees";
  if (n.includes("ant")) return "ants";
  if (n.includes("mouse") || n.includes("mice")) return "rodents-mice";
  if (n.includes("rat")) return "rodents-rats";
  if (n.includes("spider")) return "spiders";
  if (n.includes("bed bug") || n.includes("bedbug")) return "bed-bugs";
  if (n.includes("mosquito")) return "mosquitoes";
  if (n.includes("flea")) return "fleas";
  if (
    n.includes("wasp") ||
    n.includes("hornet") ||
    n.includes("yellowjacket") ||
    n.includes("yellow jacket") ||
    n.includes("mud dauber")
  )
    return "wasps-hornets";
  if (n.includes("silverfish")) return "silverfish";
  if (
    n.includes("millipede") ||
    n.includes("centipede") ||
    n.includes("earwig") ||
    n.includes("springtail") ||
    n.includes("occasional invader")
  )
    return "occasional-invaders";
  if (n.includes("no pest") || n.includes("general inspection") || n.includes("none identified"))
    return "general-inspection";
  return null;
}
