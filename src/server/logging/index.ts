import ILogger from "./ILogger.js";
import ILoggerProvider from "./ILoggerProvider.js";
import NullLogger from "./NullLogger.js";
import ComputeJsConsoleLoggerProvider, { LogLevel, LoggerDef, LoggerDefs } from "./ComputeJsConsoleLoggerProvider.js";
import { getLogger, getLoggerProvider, setLoggerProvider } from "./util.js";

export {
  ILogger,
  ILoggerProvider,
  NullLogger,
  ComputeJsConsoleLoggerProvider,
  LogLevel,
  LoggerDef,
  LoggerDefs,
  getLoggerProvider,
  setLoggerProvider,
  getLogger,
};
