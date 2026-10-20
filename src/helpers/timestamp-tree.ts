export const OWN: unique symbol = Symbol('timestamp');
export const DELETED: unique symbol = Symbol('deleted');

/**
 * Timestamps are kept per write, not per leaf: a node holds the time its path was last written
 * (or deleted), and every descendant without a node of its own inherits it.
 */
export type TimestampNode = {
  [OWN]?: number;
  [DELETED]?: true;
  [segment: string]: TimestampNode;
};

export const createTimestampNode = (): TimestampNode => Object.create(null);

/** Replaces the subtree at `segments` with a single node stamped `timestamp`. */
export function stampPath(root: TimestampNode, segments: string[], timestamp: number, deleted: boolean = false) {
  let node: TimestampNode = root;
  for (let i = 0; i < segments.length - 1; i++) {
    node = node[segments[i]] || (node[segments[i]] = createTimestampNode());
  }
  const leaf: TimestampNode = createTimestampNode();
  leaf[OWN] = timestamp;
  if (deleted) {
    leaf[DELETED] = true;
  }
  node[segments[segments.length - 1]] = leaf;
}

/** Stamps a single leaf without touching the rest of the subtree (used while restoring). */
export function stampLeaf(root: TimestampNode, segments: string[], timestamp: number) {
  let node: TimestampNode = root;
  for (const segment of segments) {
    node = node[segment] || (node[segment] = createTimestampNode());
  }
  node[OWN] = timestamp;
}

function maxInSubtree(node: TimestampNode): number | undefined {
  let max: number | undefined = node[OWN];
  for (const segment in node) {
    const childMax: number | undefined = maxInSubtree(node[segment]);
    if (childMax !== undefined && (max === undefined || childMax > max)) {
      max = childMax;
    }
  }
  return max;
}

/** Latest write that affects `segments`: the closest stamped ancestor, the path itself, or anything below it. */
export function latestTimestamp(root: TimestampNode, segments: string[]): number | undefined {
  let node: TimestampNode | undefined = root;
  let inherited: number | undefined = root[OWN];
  for (const segment of segments) {
    node = node[segment];
    if (!node) {
      return inherited;
    }
    if (node[OWN] !== undefined) {
      inherited = node[OWN];
    }
  }
  const below: number | undefined = maxInSubtree(node);
  return below !== undefined && (inherited === undefined || below > inherited) ? below : inherited;
}

/** Yields [segments, timestamp] of every tombstone, oldest first. */
export function collectTombstones(root: TimestampNode): [
  string[],
  number,
][] {
  const result: [
    string[],
    number,
  ][] = [];
  const visit = (node: TimestampNode, segments: string[]) => {
    if (node[DELETED]) {
      result.push([
        segments,
        node[OWN],
      ]);
    }
    for (const segment in node) {
      visit(node[segment], [
        ...segments,
        segment,
      ]);
    }
  };
  visit(root, []);
  return result.sort((a, b) => a[1] - b[1]);
}

/** Drops tombstones older than `before`; returns how many were removed. */
export function purgeTombstones(root: TimestampNode, before: number): number {
  let removed: number = 0;
  const visit = (node: TimestampNode): boolean => {
    for (const segment in node) {
      if (visit(node[segment])) {
        delete node[segment];
      }
    }
    if (node[DELETED] && node[OWN] < before) {
      removed++;
      delete node[DELETED];
      delete node[OWN];
    }
    return node !== root && node[OWN] === undefined && isEmpty(node);
  };
  visit(root);
  return removed;
}

function isEmpty(node: TimestampNode): boolean {
  for (const _ in node) {
    return false;
  }
  return true;
}

/**
 * Collapses per-leaf stamps (as produced by restore) to one stamp per write: a subtree written at a single
 * time becomes one node, and a mixed subtree keeps its most common time on the node plus the exceptions.
 * Returns the subtree's uniform timestamp, or undefined if it is mixed.
 */
export function compactTimestamps(node: TimestampNode, data: any, isRoot: boolean = true): number | undefined {
  const isObject: boolean = data !== null && typeof data === 'object';
  const childResults: Map<string, number | undefined> = new Map();
  for (const segment in node) {
    childResults.set(segment, compactTimestamps(node[segment], isObject ? data[segment] : undefined, false));
  }
  if (isRoot) {
    return undefined;
  }
  const dataKeys: string[] = isObject ? Object.keys(data) : [];
  // Every data key must have a known time: its own stamp or the node's.
  let covered: boolean = true;
  const counts: Map<number, number> = new Map();
  for (const key of dataKeys) {
    const timestamp: number | undefined = childResults.has(key) ? childResults.get(key) : node[OWN];
    if (timestamp === undefined) {
      // A mixed child is covered only if it ended up with a time of its own.
      if (!childResults.has(key) || node[key][OWN] === undefined) {
        covered = false;
      }
      continue;
    }
    counts.set(timestamp, (counts.get(timestamp) || 0) + 1);
  }
  let base: number | undefined = node[OWN];
  if (base === undefined && covered) {
    let best: number = 0;
    for (const [
      timestamp,
      count,
    ] of counts) {
      if (count > best) {
        best = count;
        base = timestamp;
      }
    }
    if (base === undefined && !dataKeys.length) {
      return undefined;
    }
    node[OWN] = base;
  }
  if (base === undefined) {
    return undefined;
  }
  // Children written at the node's time are implied by it.
  let mixed: boolean = !!node[DELETED];
  for (const [
    segment,
    timestamp,
  ] of childResults) {
    if (timestamp === base && Object.prototype.hasOwnProperty.call(data ?? {}, segment)) {
      delete node[segment];
    } else {
      mixed = true;
    }
  }
  return mixed ? undefined : base;
}
