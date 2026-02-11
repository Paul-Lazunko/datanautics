import { EventEmitter } from 'events';
import { existsSync, writeFileSync, readFileSync, watch, writeFile } from 'fs';
import { PropertyAccessor } from 'property-accessor';

import { DUMP_EVENT, defaultDatanauticsOptions, falsyValues, numberRegExp, intRegExp, boolRegExp } from '@const';
import { DatanauticsOptions } from '@options';
import { normalizeDump } from './helpers';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected dumpData: Map<string,string>;
  protected updateTracking: Record<string, number>;
  protected eventEmitter: EventEmitter;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    this.dumpData = new Map();
    this.updateTracking = {};
    this.eventEmitter = new EventEmitter();
    if (existsSync(this.options.dumpPath)) {
      this.useDump();
    } else {
      writeFileSync(this.options.dumpPath, '', 'utf8');
    }
    if (options.writer) {
      this.eventEmitter.on(DUMP_EVENT, async () => {
        this.createDump();
        setTimeout(() => {
          this.eventEmitter.emit(DUMP_EVENT);
        }, this.options.dumpInterval);
      });
      this.eventEmitter.emit(DUMP_EVENT);
    } else {
      watch(this.options.dumpPath, () => {
        this.useDump();
      });
    }
  }

  public normalizeDump() {
    return normalizeDump(this.options.dumpPath);
  }

  public store() {
    return this.createDump();
  }

  protected createDump() {
    try {
      const flat: Record<string, string> = PropertyAccessor.flat(this.data, '␣');
      const now: number = Date.now();
      this.dumpData.clear();
      for (const key in flat) {
        const value = PropertyAccessor.get(key.replace(/␣/g, ' '), this.data);
        const timestamp = PropertyAccessor.get(key, this.updateTracking) || now;
        if (value || falsyValues.includes(value)) {
          this.dumpData.set(key, `${timestamp} ${key} ${value.toString()}`);
        }
      }
      writeFile(this.options.dumpPath, Array.from(this.dumpData.values()).join('\n'), 'utf8', (error: Error) => {
          if (error) {
            this.options.logger?.error(error);
          }
        }
      );
    } catch (e) {
      if (this.options.verbose) {
        this.options.logger.error(e);
      }
    }
  }

  protected useDump() {
    const data = readFileSync(this.options.dumpPath).toString('utf8');
    const lines: string[] = data.split('\n');
    for (const line of lines) {
      if (!line) {
        continue;
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
        t = Date.now().toString(10);
        [
          k,
          ...rest
        ] = lineData;
      }
      const key = k.trim().replace(/␣/g, ' ');
      const v = rest.join(' ');
      if (key && v !== undefined) {
        let value: any = v.trim();
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
        }
        PropertyAccessor.set(key, value, this.data);
        PropertyAccessor.set(key, parseInt(t, 10), this.updateTracking);
      } else {
        PropertyAccessor.delete(key, this.data);
        PropertyAccessor.delete(key, this.updateTracking);
      }
    }
  }

  public set(key: string, value: any): boolean {
    PropertyAccessor.set(key, Date.now(), this.updateTracking);
    return PropertyAccessor.set(key, value, this.data);
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }
}
