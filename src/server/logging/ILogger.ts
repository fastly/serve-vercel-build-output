export default interface ILogger {
  log(...objects: any[]): void;
  debug(...objects: any[]): void;
  info(...objects: any[]): void;
  warn(...objects: any[]): void;
  error(...objects: any[]): void;
}
