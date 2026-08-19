/**
 * Checklist progress for one procedure, keyed `crescent-procedure-{slug}`.
 *
 * Exposed as a snapshot string (not an object) so useSyncExternalStore can read
 * it without hydration mismatches or referential churn. localStorage is the
 * source of truth; an in-memory mirror keeps the UI working when storage is
 * blocked (private mode, full quota).
 */
export const EMPTY_CHECKS = "[]";

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function key(slug: string) {
  return `crescent-procedure-${slug}`;
}

export function subscribeChecks(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getChecksSnapshot(slug: string) {
  const k = key(slug);
  try {
    const stored = window.localStorage.getItem(k);
    if (stored !== null) return stored;
  } catch {
    // storage unavailable — fall through to the in-memory mirror
  }
  return memory.get(k) ?? EMPTY_CHECKS;
}

export function setChecks(slug: string, ids: string[]) {
  const k = key(slug);
  const json = JSON.stringify(ids);
  memory.set(k, json);
  try {
    window.localStorage.setItem(k, json);
  } catch {
    // progress stays in memory for this session only
  }
  for (const listener of listeners) listener();
}

/** Parse a snapshot, dropping any id that is no longer a checkable step. */
export function parseChecks(snapshot: string, valid: Set<string>) {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed.filter(
        (id): id is string => typeof id === "string" && valid.has(id),
      ),
    );
  } catch {
    return new Set<string>();
  }
}
