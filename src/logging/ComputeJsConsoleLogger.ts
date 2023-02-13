import ILogger from "./ILogger";

export enum LogLevel {
  DEBUG = 3,
  INFO = 2,
  WARN = 1,
  ERROR = 0,
}

export default class ComputeJsConsoleLogger implements ILogger {

  logLevel: LogLevel;

  constructor(logLevel: LogLevel = LogLevel.DEBUG) {
    this.logLevel = logLevel;
  }

  checkLogLevel(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(...objects: any[]): void {
    if (!this.checkLogLevel(LogLevel.DEBUG)) {
      return;
    }
    console.debug(...objects);
  }

  info(...objects: any[]): void {
    if (!this.checkLogLevel(LogLevel.INFO)) {
      return;
    }
    console.info(...objects);
  }

  warn(...objects: any[]): void {
    if (!this.checkLogLevel(LogLevel.WARN)) {
      return;
    }
    console.warn(...objects);
  }

  error(...objects: any[]): void {
    if (!this.checkLogLevel(LogLevel.ERROR)) {
      return;
    }
    console.error(...objects);
  }

  log(...objects: any[]): void {
    console.log(...objects);
  }
}
