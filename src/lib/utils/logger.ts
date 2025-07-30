// Production-safe logging utility
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const logger = {
  // Development only logs
  dev: {
    log: (...args: any[]) => {
      if (isDevelopment) {
        console.log(...args)
      }
    },
    info: (...args: any[]) => {
      if (isDevelopment) {
        console.info(...args)
      }
    },
    warn: (...args: any[]) => {
      if (isDevelopment) {
        console.warn(...args)
      }
    },
    error: (...args: any[]) => {
      if (isDevelopment) {
        console.error(...args)
      }
    }
  },

  // Production safe logs (only errors and critical info)
  prod: {
    error: (...args: any[]) => {
      console.error(...args)
    },
    critical: (...args: any[]) => {
      console.error('[CRITICAL]', ...args)
    },
    info: (...args: any[]) => {
      if (!isProduction) {
        console.info(...args)
      }
    }
  },

  // Always log (both dev and prod)
  always: {
    log: (...args: any[]) => {
      console.log(...args)
    },
    info: (...args: any[]) => {
      console.info(...args)
    },
    warn: (...args: any[]) => {
      console.warn(...args)
    },
    error: (...args: any[]) => {
      console.error(...args)
    }
  }
}

// Convenience functions
export const devLog = logger.dev.log
export const devInfo = logger.dev.info
export const devWarn = logger.dev.warn
export const devError = logger.dev.error

export const prodError = logger.prod.error
export const prodCritical = logger.prod.critical
export const prodInfo = logger.prod.info
