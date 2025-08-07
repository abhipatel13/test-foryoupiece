import { NextResponse } from 'next/server'

/**
 * Sanitized error response interface
 */
export interface SanitizedErrorResponse {
  success: false
  error: string
  message?: string
  timestamp?: string
  requestId?: string
}

/**
 * Error types that should be handled differently
 */
export enum ErrorType {
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  EXTERNAL_API = 'external_api',
  INTERNAL = 'internal',
  RATE_LIMIT = 'rate_limit'
}

/**
 * Error severity levels for logging
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Detailed error information for server-side logging
 */
interface DetailedErrorInfo {
  originalError: any
  errorType: ErrorType
  severity: ErrorSeverity
  context: Record<string, any>
  stackTrace?: string
  timestamp: string
  requestId?: string
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(error: any, errorType: ErrorType): string {
  // Generic messages that don't reveal system internals
  const genericMessages: Record<ErrorType, string> = {
    [ErrorType.DATABASE]: 'A database error occurred while processing your request',
    [ErrorType.AUTHENTICATION]: 'Authentication failed',
    [ErrorType.AUTHORIZATION]: 'You are not authorized to perform this action',
    [ErrorType.VALIDATION]: 'Invalid request data provided',
    [ErrorType.EXTERNAL_API]: 'External service temporarily unavailable',
    [ErrorType.INTERNAL]: 'An internal server error occurred',
    [ErrorType.RATE_LIMIT]: 'Rate limit exceeded'
  }

  // For validation errors, we can be more specific if the error is safe
  if (errorType === ErrorType.VALIDATION && error?.message) {
    const message = error.message.toLowerCase()
    // Only return specific validation messages that don't reveal schema info
    if (message.includes('required') || message.includes('invalid format') || 
        message.includes('too long') || message.includes('too short')) {
      return error.message
    }
  }

  // For authentication errors, we can be slightly more specific
  if (errorType === ErrorType.AUTHENTICATION && error?.message) {
    const message = error.message.toLowerCase()
    if (message.includes('invalid credentials') || message.includes('user not found') ||
        message.includes('password incorrect') || message.includes('account locked')) {
      return 'Invalid email or password'
    }
  }

  return genericMessages[errorType] || genericMessages[ErrorType.INTERNAL]
}

/**
 * Log detailed error information server-side
 */
function logDetailedError(errorInfo: DetailedErrorInfo): void {
  const logLevel = errorInfo.severity === ErrorSeverity.CRITICAL ? 'error' : 
                   errorInfo.severity === ErrorSeverity.HIGH ? 'error' :
                   errorInfo.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info'

  const logData = {
    requestId: errorInfo.requestId,
    errorType: errorInfo.errorType,
    severity: errorInfo.severity,
    timestamp: errorInfo.timestamp,
    context: errorInfo.context,
    originalError: {
      message: errorInfo.originalError?.message,
      code: errorInfo.originalError?.code,
      name: errorInfo.originalError?.name,
      details: errorInfo.originalError?.details,
      hint: errorInfo.originalError?.hint
    },
    stackTrace: errorInfo.stackTrace
  }

  // Use appropriate console method based on severity
  if (logLevel === 'error') {
    console.error('🚨 SANITIZED ERROR LOG:', JSON.stringify(logData, null, 2))
  } else if (logLevel === 'warn') {
    console.warn('⚠️ SANITIZED ERROR LOG:', JSON.stringify(logData, null, 2))
  } else {
    console.log('ℹ️ SANITIZED ERROR LOG:', JSON.stringify(logData, null, 2))
  }
}

/**
 * Create a sanitized error response
 */
export function createSanitizedErrorResponse(
  error: any,
  errorType: ErrorType,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context: Record<string, any> = {},
  statusCode: number = 500
): NextResponse {
  const requestId = generateRequestId()
  const timestamp = new Date().toISOString()

  // Log detailed error information server-side
  const detailedErrorInfo: DetailedErrorInfo = {
    originalError: error,
    errorType,
    severity,
    context,
    stackTrace: error?.stack,
    timestamp,
    requestId
  }

  logDetailedError(detailedErrorInfo)

  // Create sanitized response for client
  const sanitizedMessage = sanitizeErrorMessage(error, errorType)
  
  const response: SanitizedErrorResponse = {
    success: false,
    error: sanitizedMessage,
    timestamp,
    requestId
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Handle database errors specifically
 */
export function handleDatabaseError(
  error: any,
  context: Record<string, any> = {},
  operation: string = 'database operation'
): NextResponse {
  // Determine severity based on error type
  let severity = ErrorSeverity.MEDIUM
  
  if (error?.code === 'PGRST116') {
    // Not found error - lower severity
    severity = ErrorSeverity.LOW
    return NextResponse.json({
      success: false,
      error: 'Resource not found'
    }, { status: 404 })
  }

  if (error?.code?.startsWith('23')) {
    // Constraint violation - medium severity
    severity = ErrorSeverity.MEDIUM
  }

  if (error?.code?.startsWith('08')) {
    // Connection error - high severity
    severity = ErrorSeverity.HIGH
  }

  return createSanitizedErrorResponse(
    error,
    ErrorType.DATABASE,
    severity,
    { ...context, operation },
    500
  )
}

/**
 * Handle authentication errors specifically
 */
export function handleAuthenticationError(
  error: any,
  context: Record<string, any> = {}
): NextResponse {
  return createSanitizedErrorResponse(
    error,
    ErrorType.AUTHENTICATION,
    ErrorSeverity.MEDIUM,
    context,
    401
  )
}

/**
 * Handle authorization errors specifically
 */
export function handleAuthorizationError(
  error: any,
  context: Record<string, any> = {}
): NextResponse {
  return createSanitizedErrorResponse(
    error,
    ErrorType.AUTHORIZATION,
    ErrorSeverity.MEDIUM,
    context,
    403
  )
}

/**
 * Handle validation errors specifically
 */
export function handleValidationError(
  error: any,
  context: Record<string, any> = {}
): NextResponse {
  return createSanitizedErrorResponse(
    error,
    ErrorType.VALIDATION,
    ErrorSeverity.LOW,
    context,
    400
  )
}

/**
 * Handle external API errors specifically
 */
export function handleExternalApiError(
  error: any,
  context: Record<string, any> = {},
  apiName: string = 'external service'
): NextResponse {
  return createSanitizedErrorResponse(
    error,
    ErrorType.EXTERNAL_API,
    ErrorSeverity.MEDIUM,
    { ...context, apiName },
    503
  )
}

/**
 * Generic error handler for catch blocks
 */
export function handleGenericError(
  error: any,
  context: Record<string, any> = {}
): NextResponse {
  return createSanitizedErrorResponse(
    error,
    ErrorType.INTERNAL,
    ErrorSeverity.HIGH,
    context,
    500
  )
}
