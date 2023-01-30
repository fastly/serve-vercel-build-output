import ILogger from "./ILogger.js";

export default interface ILoggerProvider {
  getLogger(name: string | null): ILogger;
}
