"use client"

import { useEffect } from "react"
import { installGlobalErrorHandlers } from "@/lib/logging/error-logger"

/**
 * Client component that installs global error handlers on mount.
 * Place once in the root layout to capture unhandled errors and rejections.
 */
export function ErrorHandlerInit() {
  useEffect(() => {
    installGlobalErrorHandlers()
  }, [])

  return null
}
