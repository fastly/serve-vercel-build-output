import ILogger from "./ILogger";

export default interface ILoggerProvider {
  getLogger(name: string | null): ILogger;
}
