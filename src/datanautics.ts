import { Writable, Readable } from 'stream';
import { PropertyAccessor, splitPath, validatePath } from 'property-accessor';

import { defaultDatanauticsOptions, numberRegExp, intRegExp, boolRegExp, objRegEx, objExtractRegEx } from '@const';
import { DatanauticsOptions } from '@options';
import {
  OWN,
  TimestampNode,
  collectTombstones,
  compactTimestamps,
  createTimestampNode,
  latestTimestamp,
  processStreamByLine,
  purgeTombstones,
  serializeValue,
  stampLeaf,
  stampPath,
  walkLeaves,
} from '@helper';

const TOMBSTONE: string = 'undefined';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected timestamps: TimestampNode;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    this.timestamps = createTimestampNode();
  }

  public async init(stream: Readable) {
    await this.restore(stream);
  }

  /**
   * Writes the current state: tombstones first (oldest first), then every leaf with the time it was written.
   * Lines are generated from the live data, so overwritten keys are never written.
   */
  public async store(stream: Writable) {
    const write = async (line: string) => {
      if (!stream.write(line)) {
        await new Promise((resolve) => stream.once('drain', () => resolve(true)));
      }
    };
    for (const [
      segments,
      timestamp,
    ] of collectTombstones(this.timestamps)) {
      await write(`${timestamp} ${toPath(segments).replace(/\s/g, '␣')} ${TOMBSTONE}\n`);
    }
    for (const rootKey of Object.keys(this.data)) {
      for (const [
        path,
        value,
        timestamp,
      ] of walkLeaves(rootKey, this.data[rootKey], this.timestamps[rootKey], this.timestamps[OWN])) {
        if (value === undefined) {
          continue;
        }
        await write(`${timestamp ?? Date.now()} ${path.replace(/\s/g, '␣')} ${serializeValue(value)}\n`);
      }
    }
    await new Promise((resolve) => stream.end(resolve));
  }

  public async restore(stream: Readable) {
    await processStreamByLine(stream, (line: string) => {
      if (!line) {
        return;
      }
      const lineData: string[] = line.split(' ');
      let t: string;
      let k: string;
      let rest: any;
      if (lineData.length > 2) {
        [
          t,
          k,
          ...rest
        ] = lineData;
      } else {
        [
          k,
          ...rest
        ] = lineData;
      }
      const key = k.trim().replace(/␣/g, ' ');
      if (!key || !validatePath(key)) {
        return;
      }
      const segments: string[] = splitPath(key);
      const timestamp: number | undefined = t !== undefined && /^\d+$/.test(t) ? Number(t) : undefined;
      // Copy out of the chunk: a substring would otherwise keep the whole chunk alive.
      let value: any = copyString(rest.join(' ').trim());
      if (value === TOMBSTONE) {
        this.removeData(segments);
        if (timestamp !== undefined) {
          stampPath(this.timestamps, segments, timestamp, true);
        }
        return;
      }
      if (numberRegExp.test(value)) {
        if (intRegExp.test(value)) {
          const valueInt: number = Number.parseInt(value, 10);
          if (!Number.isSafeInteger(valueInt)) {
            value = BigInt(value);
          } else {
            value = valueInt;
          }
        } else {
          value = parseFloat(value);
        }
      } else if (boolRegExp.test(value)) {
        value = value === 'true';
      } else if (objRegEx.test(value)) {
        try {
          value = JSON.parse(value.replace(objExtractRegEx, ''));
        } catch (e) {
          value = value.toString();
        }
      }
      PropertyAccessor.set(key, value, this.data);
      if (timestamp !== undefined) {
        stampLeaf(this.timestamps, segments, timestamp);
      }
    });
    compactTimestamps(this.timestamps, this.data);
  }

  /**
   * Writes `value` at `key`, replacing everything under it, stamped with `timestamp` (default: now).
   * Setting `undefined` is the same as `delete(key, timestamp)`.
   */
  public set(key: string, value: any, timestamp: number = Date.now()): boolean {
    if (value === undefined) {
      return this.delete(key, timestamp);
    }
    if (!PropertyAccessor.set(key, value, this.data)) {
      return false;
    }
    stampPath(this.timestamps, splitPath(key), timestamp);
    return true;
  }

  /** Removes `key` and everything under it, and keeps a tombstone stamped with `timestamp` (default: now). */
  public delete(key: string, timestamp: number = Date.now()): boolean {
    if (!key || !validatePath(key)) {
      return false;
    }
    const segments: string[] = splitPath(key);
    this.removeData(segments);
    stampPath(this.timestamps, segments, timestamp, true);
    return true;
  }

  /** Applies the write only if it is newer than anything written at, above or below `key`. */
  public setIfNewer(key: string, value: any, timestamp: number): boolean {
    if (!this.isNewer(key, timestamp)) {
      return false;
    }
    return this.set(key, value, timestamp);
  }

  /** Applies the delete only if it is newer than anything written at, above or below `key`. */
  public deleteIfNewer(key: string, timestamp: number): boolean {
    if (!this.isNewer(key, timestamp)) {
      return false;
    }
    return this.delete(key, timestamp);
  }

  /**
   * Time of the latest write or delete that affects `key`: on the key itself, on the closest
   * ancestor written as a whole, or on anything below it. `undefined` if it was never written.
   */
  public getTimestamp(key: string): number | undefined {
    if (!key || !validatePath(key)) {
      return undefined;
    }
    return latestTimestamp(this.timestamps, splitPath(key));
  }

  /**
   * Forgets tombstones older than `before`. Call it once every peer is known to have seen those deletes;
   * after that an older write for a purged key is accepted again.
   */
  public purgeTombstones(before: number): number {
    return purgeTombstones(this.timestamps, before);
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }

  private isNewer(key: string, timestamp: number): boolean {
    const current: number | undefined = this.getTimestamp(key);
    return current === undefined || timestamp > current;
  }

  /** Deletes the value at `segments` without creating missing parents (PropertyAccessor.delete does). */
  private removeData(segments: string[]) {
    let target: any = this.data;
    for (let i = 0; i < segments.length - 1; i++) {
      target = target[segments[i]];
      if (target === null || typeof target !== 'object') {
        return;
      }
    }
    delete target[segments[segments.length - 1]];
  }
}

const pathArrayIndexRegExp: RegExp = /^(0|[1-9]\d*)$/;

function toPath(segments: string[]): string {
  return segments
    .map((segment: string, i: number) => {
      if (pathArrayIndexRegExp.test(segment) && i > 0) {
        return `[${segment}]`;
      }
      if (
        segment.includes('.') ||
        segment.includes('[') ||
        segment.includes(']') ||
        /^\d{4}-\d{2}-\d{2}T/.test(segment)
      ) {
        return `['${segment}']`;
      }
      return i > 0 ? `.${segment}` : segment;
    })
    .join('');
}

function copyString(value: string): string {
  return value.length < 13 ? value : Buffer.from(value, 'utf8').toString('utf8');
}
