import util from "node:util";

type LogLevel = "info" | "warn" | "error" | "debug";

const REDACTED_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "clerk_secret_key",
  "aws_secret_access_key",
  "atlas_uri",
  "ola_map_client_secret",
]);

function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "\x1b[36m",    // Cyan
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  debug: "\x1b[35m",   // Magenta
};

const RESET = "\x1b[0m";
const DIM = "\x1b[90m";
const BOLD = "\x1b[1m";

function formatTimestamp(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}.${ms}`;
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  const sanitized = sanitizeData(meta) as Record<string, unknown>;
  const keys = Object.keys(sanitized);
  if (keys.length === 0) return "";

  // If simple primitive values, print inline cleanly
  const isSimple = keys.every(
    (k) => typeof sanitized[k] !== "object" || sanitized[k] === null
  );

  if (isSimple && keys.length <= 4) {
    const pairs = keys
      .map((k) => `${k}=${JSON.stringify(sanitized[k])}`)
      .join(" ");
    return ` ${DIM}(${pairs})${RESET}`;
  }

  // Multi-line formatted object with colors
  const inspected = util.inspect(sanitized, {
    colors: true,
    depth: 4,
    compact: false,
    breakLength: 80,
  });
  return (
    "\n" +
    inspected
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")
  );
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      this.log("debug", message, meta);
    }
  },
  log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    // If LOG_FORMAT is explicitly configured as 'json', output JSON for log aggregators
    if (process.env.LOG_FORMAT === "json") {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(meta ? (sanitizeData(meta) as Record<string, unknown>) : {}),
      };
      if (level === "error") {
        console.error(JSON.stringify(entry));
      } else if (level === "warn") {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
      return;
    }

    // Default: Clean, human-readable formatted console log with color badges and timestamp
    const color = LEVEL_COLORS[level] || RESET;
    const badge = `${color}${BOLD}[${level.toUpperCase().padEnd(5)}]${RESET}`;
    const time = `${DIM}[${formatTimestamp()}]${RESET}`;
    const metaStr = formatMeta(meta);
    const line = `${time} ${badge} ${message}${metaStr}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  },
};
