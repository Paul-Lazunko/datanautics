interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type DatanauticsOptions = {
  dumpPath: string;
  dumpInterval?: number;
  verbose?: boolean;
  logger?: Logger;
  cancelAutoSave?: boolean;
};
