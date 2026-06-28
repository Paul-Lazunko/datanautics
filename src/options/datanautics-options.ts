interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type DatanauticsOptions = {
  verbose?: boolean;
  logger?: Logger;
};
