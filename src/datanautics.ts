import { existsSync, writeFileSync, watch, createWriteStream, WriteStream } from 'fs';
import { PropertyAccessor } from 'property-accessor';
const signals = [
  'SIGINT',
  'SIGTERM',
];

import { defaultDatanauticsOptions, numberRegExp, intRegExp, boolRegExp, objRegEx, objExtractRegEx } from '@const';
import { DatanauticsOptions } from '@options';
import { processFileByLine, serializeValue } from './helpers';

export class Datanautics {
  protected options: DatanauticsOptions;
  protected data: Record<string, any>;
  protected stream: WriteStream;
  private isRestoring: boolean;

  constructor(options?: DatanauticsOptions) {
    this.options = { ...defaultDatanauticsOptions, ...(options || {}) };
    this.data = {};
    if (!existsSync(this.options.dumpPath)) {
      writeFileSync(this.options.dumpPath, '', 'utf8');
    }

  }

  public async init() {
    await this.restoreFromFile();
    if (this.options.writer) {
      this.stream = createWriteStream(this.options.dumpPath);
      signals.forEach((signal) => {
        process.once(signal, async () => {
          this.stream?.end((error: Error) => {
            console.log('Closed stream', error);
          });
        });
      });
    } else {
      watch(this.options.dumpPath, async () => {
        await this.restoreFromFile()
      });
    }
  }

  protected async  restoreFromFile() {
    this.isRestoring = true;
     await processFileByLine(this.options.dumpPath, (line: string) => {
      if (!line) {
        return;
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
    });
    this.isRestoring = false;
  }

  public set(key: string, value: any): boolean {
    const result: boolean =  PropertyAccessor.set(key, value, this.data);
    if (this.options.writer) {
      this.store(key, value);
    }
    return result;
  }

  private store(key: string, value: any) {
    const now = Date.now();
    const keys: string[] = PropertyAccessor.collectKeys(key, value);
    for (const k of keys) {
      const nk: string = k.replace(/\s/g, '␣');
      const v = PropertyAccessor.get(k, this.data);
      this.stream.write(`${now} ${nk} ${serializeValue(v)}\n`);
    }
  }

  public get(key: string): any {
    return PropertyAccessor.get(key, this.data);
  }
}
