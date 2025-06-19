import { EventEmitter } from 'events';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { PropertyAccessor } from 'property-accessor';

import { READ_EVENT, WRITE_EVENT, defaultDatanauticsOptions } from '@const';
import { DatanauticsOptions } from '@options';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected writeEventEmitter: EventEmitter;
  protected readEventEmitter: EventEmitter;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    this.writeEventEmitter = new EventEmitter();
    this.readEventEmitter = new EventEmitter();
    if (existsSync(this.options.dumpPath)) {
      this.useDump();
    }
    this.writeEventEmitter.on(WRITE_EVENT, async () => {
      this.createDump();
      setTimeout(() => {
        this.writeEventEmitter.emit(WRITE_EVENT);
      }, this.options.dumpInterval);
    });
    this.readEventEmitter.on(READ_EVENT, async () => {
      this.useDump();
      setTimeout(() => {
        this.readEventEmitter.emit(READ_EVENT);
      }, this.options.dumpInterval);
    });
    switch (options.mode) {
      case 'reader':
        this.readEventEmitter.emit(READ_EVENT)
        break;
      case 'writer':
        this.writeEventEmitter.emit(WRITE_EVENT)
        break;
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
          data.push(`${key} ${value.toString()}`);
        }
      }
      writeFileSync(this.options.dumpPath, data.join('\n'), 'utf8');
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
      const [
        k,
        v,
      ] = line.split(' ');
      const key = k.trim();
      if (v !== undefined) {
        let value: string | number | boolean = v.trim();
        if (/^[+-]?\d+(\.\d+)?$/.test(value)) {
          value = /^[+-]?\d+$/.test(value) ? parseInt(value, 10) : parseFloat(value);
        } else if (/^false|true$/.test(value)) {
          value = /^true$/.test(value);
        }
        PropertyAccessor.set(key, value, this.data);
      }
    }
  }

  public set(key: string, value: any): boolean {
    return PropertyAccessor.set(key, value, this.data);
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }
}
