import { existsSync, writeFileSync, readFileSync, watch, createWriteStream, WriteStream } from 'fs';
import { PropertyAccessor } from 'property-accessor';
const signals = [
  'SIGINT',
  'SIGTERM',
];

import { defaultDatanauticsOptions, numberRegExp, intRegExp, boolRegExp, objRegEx, objExtractRegEx } from '@const';
import { DatanauticsOptions } from '@options';
import { serializeValue } from './helpers';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected stream: WriteStream;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    if (existsSync(this.options.dumpPath)) {
      this.useDump();
    } else {
      writeFileSync(this.options.dumpPath, '', 'utf8');
    }
    if (options.writer) {
      this.stream = createWriteStream(this.options.dumpPath);
    } else {
      watch(this.options.dumpPath, () => {
        this.useDump();
      });
    }
    signals.forEach((signal) => {
      process.once(signal, async () => {
        this.stream.end((error: Error) => {
          console.log('closed stream', error);
        });
      });
    });
  }

  protected useDump() {
    const data = readFileSync(this.options.dumpPath).toString('utf8');
    const lines: string[] = data.split('\n');
    for (const line of lines) {
      if (!line) {
        continue;
      }
      const lineData: string[] = line.split(' ');
      let k: string;
      let rest: any;
      if (lineData.length > 2) {
        [
          ,
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
        } else if (objRegEx.test(value)) {
          try {
            value = JSON.parse(value.replace(objExtractRegEx, ''));
          } catch (e) {
            value = value.toString();
          }
        }
        PropertyAccessor.set(key, value, this.data);
      } else {
        PropertyAccessor.delete(key, this.data);
      }
    }
  }

  public set(key: string, value: any): boolean {
    this.store(key, value);
    return PropertyAccessor.set(key, value, this.data);
  }

  private store(key: string, value: any) {
    const baseKey = key.trim().replace(/\s/g, '␣');
    const now = Date.now();
    this.stream.write(`${now} ${baseKey} ${serializeValue(value)}\n`);
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }
}
