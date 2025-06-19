import * as console from 'console';
import { resolve } from 'path';

import { DatanauticsOptions } from '@options';

export const defaultDatanauticsOptions: DatanauticsOptions = {
  verbose: true,
  logger: console,
  dumpPath: resolve(__dirname, '../../data/data.txt'),
};
