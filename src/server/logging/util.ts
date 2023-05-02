import ILoggerProvider from "./ILoggerProvider.js";
import NullLogger from "./NullLogger.js";

let _loggerProvider: ILoggerProvider | null = null;

export function getLoggerProvider() {
  return _loggerProvider;
}
export function setLoggerProvider(loggerProvider: ILoggerProvider) {
  _loggerProvider = loggerProvider;
}

export function getLogger(name: string) {
  if (_loggerProvider == null) {
    return NullLogger.instance;
  }
  return _loggerProvider.getLogger(name);
}
