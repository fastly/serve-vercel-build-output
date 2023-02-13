import ILoggerProvider from "./ILoggerProvider";
import ILogger from "./ILogger";
import NullLogger from "./NullLogger";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerDef {
  namePattern: string | RegExp;
  logLevel: LogLevel;
}

export type LoggerDefs = LoggerDef[];

class ComputeJsConsoleLogger implements ILogger {

  name: string;

  logLevel: LogLevel;

  constructor(
    name: string,
    logLevel: LogLevel = LogLevel.DEBUG
  ) {
    this.name = name;
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

export default class ComputeJsConsoleLoggerProvider implements ILoggerProvider {

  private readonly loggerDefs: LoggerDefs;

  private readonly loggerInstances: Map<string | null, ILogger>;

  constructor(
    loggerDefs: LoggerDefs | LogLevel,
  ) {
    this.loggerDefs = Array.isArray(loggerDefs) ? loggerDefs : [
      {
        namePattern: '*',
        logLevel: loggerDefs,
      }
    ];

    this.loggerInstances = new Map<string | null, ILogger>();
  }

  testNamePattern(name: string | null, namePattern: string | RegExp) {

    if (namePattern === '*') {
      // single * accepts everything, including null name
      return true;
    }

    if (name == null) {
      // null name can only be caught by single *
      return false;
    }

    if (namePattern instanceof RegExp) {
      // if it's a regex then test it
      return namePattern.test(name);
    }

    // if it doesn't include an asterisk
    const asteriskPos = namePattern.indexOf('*');
    if (asteriskPos === -1) {
      return name === namePattern;
    }

    // handle asterisk, which can represent any number of characters
    // including empty string, but there can only be one asterisk in the
    // name pattern

    // reject it if the string is shorter than the original string minus the *
    // this avoids counting something like 'farm' when the pattern is 'fa*arm'
    if (name.length < namePattern.length - 1) {
      return false;
    }

    const sliceBefore = namePattern.slice(0, asteriskPos);
    const sliceAfter = namePattern.slice(asteriskPos+1);

    if (sliceBefore.includes('*') || sliceAfter.includes('*')) {
      throw new Error('name pattern can only include up to one asterisk.');
    }

    return name.startsWith(sliceBefore) && name.endsWith(sliceAfter);

  }

  getLogger(name: string | null = null): ILogger {

    if (name?.includes('*')) {
      throw new Error('getLogger() requested logger name cannot include an asterisk');
    }

    let logger = this.loggerInstances.get(name);
    if (logger != null) {
      return logger;
    }

    for (const loggerDef of this.loggerDefs) {
      if (this.testNamePattern(name, loggerDef.namePattern)) {

        logger = new ComputeJsConsoleLogger(name ?? '[default]', loggerDef.logLevel);
        this.loggerInstances.set(name, logger);
        break;

      }
    }

    if (logger == null) {
      logger = NullLogger.instance;
      this.loggerInstances.set(name, logger);
    }

    return logger;
  }
}
