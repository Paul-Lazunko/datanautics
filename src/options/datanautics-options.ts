interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type DatanauticsOptions = {
  dumpPath: string;
  verbose?: boolean;
  logger?: Logger;
};
