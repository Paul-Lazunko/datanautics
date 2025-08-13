import { EventEmitter } from 'events';
import { existsSync, writeFileSync, readFileSync, watch } from 'fs';
import { PropertyAccessor } from 'property-accessor';

import { DUMP_EVENT, defaultDatanauticsOptions } from '@const';
import { DatanauticsOptions } from '@options';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected timeLog: Record<string, number>;
  protected eventEmitter: EventEmitter;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    this.timeLog = {};
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
      })
    }
  }

  public store() {
    return this.createDump();
  }

  protected createDump() {
    try {
      const flat: Record<string, string> = PropertyAccessor.flat(this.data);
      const data: any[] = [];
      for (const key in flat) {
        const value = PropertyAccessor.get(key, this.data);
        if (value !== undefined) {
          data.push(`${key} ${value.toString()} ${this.timeLog[key] ? this.timeLog[key] : ''}`);
        }
      }
      writeFileSync(this.options.dumpPath, data.join('\n'), 'utf8')
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
      const [ k, ...rest] = line.split(' ');
      let timestamp: string;
      if (rest.length > 1 && /\d{13}/.test(rest[rest.length -1 ])) {
        timestamp = rest.pop();
      }
      const v = rest.join(' ');
      const key = k.trim();
      if (v !== undefined) {
        let value: string | number | boolean = v.trim();
        if (/^[+-]?\d+(\.\d+)?$/.test(value)) {
          value = /^[+-]?\d+$/.test(value) ? parseInt(value, 10) : parseFloat(value);
        } else if (/^false|true$/.test(value)) {
          value = /^true$/.test(value);
        }
        PropertyAccessor.set(key, value, this.data);
        this.timeLog[key] = parseInt(timestamp, 10);
      }
    }
  }

  public set(key: string, value: any): boolean {
    this.timeLog[key] = new Date().getTime();
    return PropertyAccessor.set(key, value, this.data);
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }
}
