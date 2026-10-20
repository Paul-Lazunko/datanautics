import { OWN, TimestampNode } from './timestamp-tree';

const arrayIndexRegExp: RegExp = /^(0|[1-9]\d*)$/;
const isoDateRegExp: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

function needsBracketNotation(key: string): boolean {
  return isoDateRegExp.test(key) || key.includes('.') || key.includes('[') || key.includes(']');
}

/**
 * Yields [path, value, timestamp] for every leaf under `value`, using the same path format as
 * PropertyAccessor.collectKeys. The timestamp is the one of the closest stamped node in `stamps`.
 * Lazy, so a dump never materialises all paths at once.
 */
export function* walkLeaves(
  path: string,
  value: any,
  stamps?: TimestampNode,
  inherited?: number,
): Generator<
  [
    string,
    any,
    number | undefined,
  ]
> {
  const timestamp: number | undefined = stamps?.[OWN] ?? inherited;
  if (value === null || typeof value !== 'object') {
    yield [
      path,
      value,
      timestamp,
    ];
    return;
  }
  // Own keys, not 0..length: PropertyAccessor.set creates arrays for numeric-looking segments
  // ("db.x.123", hex ids like "000…1"), which may hold non-index or sparse keys.
  const isArray: boolean = Array.isArray(value);
  const keys: string[] = Object.keys(value);
  if (!keys.length) {
    yield [
      path,
      value,
      timestamp,
    ];
  }
  for (const key of keys) {
    const childPath: string =
      isArray && arrayIndexRegExp.test(key)
        ? `${path}[${key}]`
        : needsBracketNotation(key)
          ? `${path}['${key}']`
          : `${path}.${key}`;
    yield* walkLeaves(childPath, value[key], stamps?.[key], timestamp);
  }
}
