import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { exec } from 'child_process'
import { EventEmitter } from 'events';
import { PropertyAccessor } from 'property-accessor';

import { DUMP_EVENT, defaultDatanauticsOptions } from '@const';
import { DatanauticsOptions } from '@options';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected eventEmitter: EventEmitter;

  constructor(options?: DatanauticsOptions) {
    this.options = Object.assign(defaultDatanauticsOptions, options || {});
    this.data = {};
    this.eventEmitter = new EventEmitter();
    this.eventEmitter = new EventEmitter();
    if (!existsSync(this.options.dumpPath)) {
      mkdirSync(this.options.dumpPath, { recursive: true });
    }
    try {
      this.useDump();
    } catch (e) {
      if (this.options.verbose) {
        this.options.logger.error(e);
      }
    }
    this.eventEmitter.on(DUMP_EVENT, () => {
      this.createDump();
      setTimeout(() => {
        this.eventEmitter.emit(DUMP_EVENT);
      }, this.options.dumpInterval);
    });
    this.eventEmitter.emit(DUMP_EVENT);
  }

  protected createDump() {
    try {
      const flat = PropertyAccessor.flat(this.data);
      for (const key in flat) {
        const value = PropertyAccessor.get(key, this.data);
        if (value !== undefined) {
          exec(`echo ${PropertyAccessor.get(key, this.data).toString()} > ${this.options.dumpPath}/${key}`)
        }
      }
    } catch (e) {
      if (this.options.verbose) {
        this.options.logger.error(e);
      }
    }
  }

  protected useDump() {
    const files: string[] = readdirSync(this.options.dumpPath);
    for (const file of files) {
      if (file !== '.gitkeep') {
        let value: string | number = readFileSync(`${this.options.dumpPath}/${file}`).toString();
        if (/^[+-]?\d+(\.\d+)?$/.test(value)) {
          value = /^[+-]?\d+$/.test(value) ? parseInt(value, 10) : parseFloat(value);
        }
        PropertyAccessor.set(file, value, this.data);
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
