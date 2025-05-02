import { existsSync, readFileSync, writeFileSync } from 'fs';
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
    if (existsSync(this.options.dumpPath)) {
      try {
        this.data = JSON.parse(readFileSync(this.options.dumpPath).toString());
      } catch (e) {
        if (this.options.verbose) {
          this.options.logger.error(e);
        }
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
      writeFileSync(this.options.dumpPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      if (this.options.verbose) {
        this.options.logger.error(e);
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
