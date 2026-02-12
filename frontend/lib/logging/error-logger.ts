/**
 * Comprehensive Error Logger
 * Captures the last N errors in IndexedDB for debugging.
 * Errors are stored as structured entries and can be exported as JSON.
 * 
 * Features:
 * - Severity levels (error, warn, info)
 * - Source module tracking
 * - Stack traces
 * - Arbitrary context metadata
 * - Page URL and user agent capture
 * - Global unhandled error/rejection capture
 * - JSON export for debugging
 */

import { db, STORES } from "@/lib/db/indexeddb"

const ERROR_LOG_KEY = "errorLog"
const MAX_ERRORS = 200

export type ErrorSeverity = "error" | "warn" | "info"

export interface ErrorLogEntry {
  id: string
  timestamp: number
  severity: ErrorSeverity
  source: string          // e.g. "armory/api", "cache/members", "global/unhandled"
  message: string
  stack?: string
  context?: Record<string, any>  // additional metadata (url, params, action, etc.)
  url?: string            // page URL where error occurred
  userAgent?: string
}

interface ErrorLogData {
  entries: ErrorLogEntry[]
}

function getPageUrl(): string {
  try {
    return typeof window !== "undefined" ? window.location.pathname : "unknown"
  } catch {
    return "unknown"
  }
}

function getUserAgent(): string {
  try {
    return typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
  } catch {
    return "unknown"
  }
}

/**
 * Log an error to the persistent error log in IndexedDB.
 */
export async function logError(
  source: string,
  error: unknown,
  context?: Record<string, any>,
  severity: ErrorSeverity = "error"
): Promise<void> {
  try {
    const entry: ErrorLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      severity,
      source,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      url: getPageUrl(),
      userAgent: getUserAgent(),
    }

    const existing = await db.get<ErrorLogData>(STORES.CACHE, ERROR_LOG_KEY)
    const entries = existing?.entries ?? []

    // Prepend new entry and cap to MAX_ERRORS
    entries.unshift(entry)
    if (entries.length > MAX_ERRORS) {
      entries.length = MAX_ERRORS
    }

    await db.set(STORES.CACHE, ERROR_LOG_KEY, { entries })
  } catch {
    // Silently fail - we can't log errors about logging errors
  }
}

/**
 * Log a warning (lower severity than error).
 */
export async function logWarn(
  source: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  return logError(source, new Error(message), context, "warn")
}

/**
 * Log an info-level event (e.g. API key revoked, session expired).
 */
export async function logInfo(
  source: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  return logError(source, new Error(message), context, "info")
}

/**
 * Get all stored error log entries.
 */
export async function getErrorLog(): Promise<ErrorLogEntry[]> {
  try {
    const data = await db.get<ErrorLogData>(STORES.CACHE, ERROR_LOG_KEY)
    return data?.entries ?? []
  } catch {
    return []
  }
}

/**
 * Clear all error log entries.
 */
export async function clearErrorLog(): Promise<void> {
  try {
    await db.delete(STORES.CACHE, ERROR_LOG_KEY)
  } catch {
    // Silently fail
  }
}

/**
 * Export error log as a structured JSON object ready for debugging.
 * Includes metadata for reproduction and analysis.
 */
export async function exportErrorLog(): Promise<object> {
  const entries = await getErrorLog()
  const severityCounts = { error: 0, warn: 0, info: 0 }
  const sourceCounts: Record<string, number> = {}

  for (const e of entries) {
    severityCounts[e.severity]++
    sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1
  }

  return {
    exportedAt: new Date().toISOString(),
    summary: {
      totalErrors: entries.length,
      maxStored: MAX_ERRORS,
      bySeverity: severityCounts,
      bySource: sourceCounts,
      oldestEntry: entries.length > 0 ? new Date(entries[entries.length - 1].timestamp).toISOString() : null,
      newestEntry: entries.length > 0 ? new Date(entries[0].timestamp).toISOString() : null,
    },
    entries: entries.map((e) => ({
      id: e.id,
      timestamp: new Date(e.timestamp).toISOString(),
      timestampMs: e.timestamp,
      severity: e.severity,
      source: e.source,
      message: e.message,
      stack: e.stack ?? null,
      context: e.context ?? null,
      url: e.url ?? null,
    })),
  }
}

/**
 * Install global error handlers to catch unhandled errors and promise rejections.
 * Should be called once at app startup.
 */
let _installed = false
export function installGlobalErrorHandlers(): void {
  if (_installed || typeof window === "undefined") return
  _installed = true

  window.addEventListener("error", (event) => {
    logError("global/unhandled", event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    logError(
      "global/unhandledrejection",
      reason instanceof Error ? reason : new Error(String(reason)),
      { type: "unhandledrejection" },
    )
  })
}
