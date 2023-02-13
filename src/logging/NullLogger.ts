import ILogger from "./ILogger";

export default class NullLogger implements ILogger {
  debug(...objects: any[]): void {}

  error(...objects: any[]): void {}

  info(...objects: any[]): void {}

  log(...objects: any[]): void {}

  warn(...objects: any[]): void {}

  public static instance: ILogger = new NullLogger();
}
