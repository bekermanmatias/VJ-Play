import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const min = order[(env.logLevel as Level) in order ? (env.logLevel as Level) : "info"];

function fmt(level: Level, scope: string, msg: string, extra?: Record<string, unknown>): string {
  const base = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${msg}`;
  if (!extra || Object.keys(extra).length === 0) return base;
  return `${base} ${JSON.stringify(extra)}`;
}

function emit(level: Level, scope: string, msg: string, extra?: Record<string, unknown>): void {
  if (order[level] < min) return;
  const line = fmt(level, scope, msg, extra);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", scope, msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => emit("info", scope, msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", scope, msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => emit("error", scope, msg, extra),
  };
}

export type Logger = ReturnType<typeof createLogger>;
