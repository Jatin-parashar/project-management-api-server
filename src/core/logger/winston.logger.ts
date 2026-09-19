import { LoggerService, LogLevel } from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonInstance,
} from 'winston';

const levelMap: Record<LogLevel, string> = {
  verbose: 'verbose',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'error',
};

const levelByEnv: Record<string, string> = {
  production: 'info',
  test: 'warn',
  development: 'debug',
};

export class WinstonLogger implements LoggerService {
  private readonly instance: WinstonInstance;

  constructor() {
    const env = process.env.NODE_ENV ?? 'development';

    this.instance = createLogger({
      level: levelByEnv[env] ?? 'debug',
      defaultMeta: { env, service: 'server' },
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: [new transports.Console()],
    });
  }

  log(message: unknown, context?: string) {
    this.instance.log(levelMap.log, message as string, { context });
  }

  error(message: unknown, trace?: string, context?: string) {
    this.instance.log(levelMap.error, message as string, { context, trace });
  }

  warn(message: unknown, context?: string) {
    this.instance.log(levelMap.warn, message as string, { context });
  }

  debug(message: unknown, context?: string) {
    this.instance.log(levelMap.debug, message as string, { context });
  }

  verbose(message: unknown, context?: string) {
    this.instance.log(levelMap.verbose, message as string, { context });
  }

  fatal(message: unknown, context?: string) {
    this.instance.log(levelMap.fatal, message as string, { context });
  }
}
