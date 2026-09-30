export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  traceId?: string;
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  durationMs?: number;
  [key: string]: any;
}

export interface StructuredLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

class StructuredLogger {
  private baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  public child(extraContext: LogContext): StructuredLogger {
    return new StructuredLogger({
      ...this.baseContext,
      ...extraContext,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...this.baseContext,
        ...context,
      },
    };

    if (process.env.NODE_ENV !== "test") {
      const output = JSON.stringify(entry);
      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    }

    return entry;
  }

  public info(message: string, context?: LogContext): StructuredLogEntry {
    return this.log("info", message, context);
  }

  public warn(message: string, context?: LogContext): StructuredLogEntry {
    return this.log("warn", message, context);
  }

  public error(message: string, context?: LogContext): StructuredLogEntry {
    return this.log("error", message, context);
  }

  public debug(message: string, context?: LogContext): StructuredLogEntry {
    return this.log("debug", message, context);
  }
}

export const logger = new StructuredLogger({ service: "omnirank-api" });
