import { EventEmitter } from 'events';
import { existsSync, createReadStream, truncate } from 'fs';
import { exec } from 'child_process';
import * as readline from 'readline';
import { PropertyAccessor } from 'property-accessor';

import { DUMP_EVENT, defaultDatanauticsOptions } from '@const';
import { DatanauticsOptions } from '@options';
import * as console from 'console';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected eventEmitter: EventEmitter;

  constructor(options?: DatanauticsOptions) {
    this.options = Object.assign(defaultDatanauticsOptions, options || {});
    this.data = {};
    this.eventEmitter = new EventEmitter();
    if (existsSync(this.options.dumpPath)) {
      this.useDump().catch(console.error).finally(() => {
        this.eventEmitter.on(DUMP_EVENT, async () => {
          await this.flushDump();
          await this.createDump();
          setTimeout(() => {
            this.eventEmitter.emit(DUMP_EVENT);
          }, this.options.dumpInterval);
        });
        this.eventEmitter.emit(DUMP_EVENT);
      })
    } else {
      this.eventEmitter.on(DUMP_EVENT, async () => {
        await this.flushDump();
        await this.createDump();
        setTimeout(() => {
          this.eventEmitter.emit(DUMP_EVENT);
        }, this.options.dumpInterval);
      });
      this.eventEmitter.emit(DUMP_EVENT);
    }
  }

  protected flushDump(): Promise<void> {
    return new Promise((resolve, reject) => {
      truncate(this.options.dumpPath, (error: Error) => {
        error ? reject(error) : resolve();
      })
    })
  }

  protected async createDump() {
    try {
      const flat = PropertyAccessor.flat(this.data);
      for (const key in flat) {
        const value = PropertyAccessor.get(key, this.data);
        if (value !== undefined) {
          try {
            await new Promise((resolve, reject) => {
              exec(`echo "${key} ${value.toString()}" >> ${this.options.dumpPath}`, (error) => {
                error ? reject(error) : resolve(true)
              });
            })
          } catch(e) {
            console.error(e)
          }
        }
      }
    } catch (e) {
      if (this.options.verbose) {
        this.options.logger.error(e);
      }
    }
  }

  protected async useDump() {
    const readStream = createReadStream(this.options.dumpPath);
    const lines = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity, // handles both \n and \r\n
    });
    for await (const line of lines) {
      const data = line.split(' ');
      const key: string = data[0];
      let value:  string | number | boolean = data[1];
      if (key && value) {
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
