import { fileTypeFromBuffer } from 'file-type'
import DOMPurify from 'isomorphic-dompurify'

/**
 * Enhanced File Validation Security System
 * Validates file content using magic numbers, not just MIME types
 */

export interface FileValidationResult {
  isValid: boolean
  detectedType?: string
  detectedExtension?: string
  errors: string[]
  warnings: string[]
  sanitizedContent?: Buffer
}

export interface FileValidationOptions {
  maxSize?: number // in bytes
  allowedTypes?: string[]
  allowedExtensions?: string[]
  requireContentValidation?: boolean
  sanitizeSvg?: boolean
  checkForMaliciousPatterns?: boolean
}

/**
 * Allowed image types with their magic number signatures
 */
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    magicNumbers: [
      [0xFF, 0xD8, 0xFF], // JPEG
    ]
  },
  'image/png': {
    extensions: ['png'],
    magicNumbers: [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ]
  },
  'image/webp': {
    extensions: ['webp'],
    magicNumbers: [
      [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
    ]
  },
  'image/gif': {
    extensions: ['gif'],
    magicNumbers: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ]
  },
  'image/svg+xml': {
    extensions: ['svg'],
    magicNumbers: [] // SVG is XML-based, handled separately
  }
}

/**
 * Malicious patterns to detect in files
 */
const MALICIOUS_PATTERNS = [
  // JavaScript patterns
  /<script[^>]*>/i,
  /javascript:/i,
  /vbscript:/i,
  /onload\s*=/i,
  /onerror\s*=/i,
  /onclick\s*=/i,
  
  // PHP patterns
  /<\?php/i,
  /<\?=/i,
  
  // Server-side includes
  /<!--#/i,
  
  // Data URIs with scripts
  /data:.*script/i,
  
  // Common exploit patterns
  /eval\s*\(/i,
  /document\.write/i,
  /window\.location/i,
]

/**
 * Check if buffer starts with any of the given magic numbers
 */
function checkMagicNumbers(buffer: Buffer, magicNumbers: number[][]): boolean {
  return magicNumbers.some(magic => {
    if (buffer.length < magic.length) return false
    return magic.every((byte, index) => buffer[index] === byte)
  })
}

/**
 * Validate file content using magic numbers
 */
async function validateFileContent(buffer: Buffer): Promise<{
  detectedType?: string
  detectedExtension?: string
  isValid: boolean
}> {
  try {
    // Use file-type library for comprehensive detection
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (fileType) {
      // Check if detected type is in our allowed list
      const isAllowed = Object.keys(ALLOWED_IMAGE_TYPES).includes(fileType.mime)
      
      return {
        detectedType: fileType.mime,
        detectedExtension: fileType.ext,
        isValid: isAllowed
      }
    }
    
    // Fallback to manual magic number checking
    for (const [mimeType, config] of Object.entries(ALLOWED_IMAGE_TYPES)) {
      if (config.magicNumbers.length > 0 && checkMagicNumbers(buffer, config.magicNumbers)) {
        return {
          detectedType: mimeType,
          detectedExtension: config.extensions[0],
          isValid: true
        }
      }
    }
    
    // Check for SVG (XML-based)
    const textContent = buffer.toString('utf8', 0, Math.min(1024, buffer.length))
    if (textContent.includes('<svg') || textContent.includes('<?xml')) {
      return {
        detectedType: 'image/svg+xml',
        detectedExtension: 'svg',
        isValid: true
      }
    }
    
    return {
      isValid: false
    }
    
  } catch (error) {
    console.error('Error validating file content:', error)
    return {
      isValid: false
    }
  }
}

/**
 * Sanitize SVG content to prevent XSS attacks
 */
function sanitizeSvgContent(buffer: Buffer): Buffer {
  try {
    const svgContent = buffer.toString('utf8')
    
    // Configure DOMPurify for SVG sanitization
    const cleanSvg = DOMPurify.sanitize(svgContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ALLOWED_TAGS: [
        'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'rect', 'polyline', 'polygon',
        'text', 'tspan', 'defs', 'clipPath', 'mask', 'pattern', 'image', 'switch',
        'foreignObject', 'use', 'symbol', 'marker', 'linearGradient', 'radialGradient',
        'stop', 'animate', 'animateTransform', 'animateMotion', 'set'
      ],
      ALLOWED_ATTR: [
        'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
        'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity',
        'transform', 'viewBox', 'preserveAspectRatio', 'xmlns', 'xmlns:xlink',
        'id', 'class', 'style', 'gradientUnits', 'gradientTransform', 'offset', 'stop-color',
        'stop-opacity', 'patternUnits', 'patternTransform', 'clipPathUnits', 'maskUnits'
      ],
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'textarea'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      REMOVE_SCRIPTS: true,
      REMOVE_SCRIPT_CONTENT: true
    })
    
    return Buffer.from(cleanSvg, 'utf8')
  } catch (error) {
    console.error('Error sanitizing SVG:', error)
    throw new Error('Failed to sanitize SVG content')
  }
}

/**
 * Check for malicious patterns in file content
 */
function checkMaliciousPatterns(buffer: Buffer): string[] {
  const warnings: string[] = []
  const content = buffer.toString('utf8', 0, Math.min(10240, buffer.length)) // Check first 10KB
  
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(`Potentially malicious pattern detected: ${pattern.source}`)
    }
  }
  
  return warnings
}

/**
 * Comprehensive file validation function
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = Object.keys(ALLOWED_IMAGE_TYPES),
    allowedExtensions = Object.values(ALLOWED_IMAGE_TYPES).flatMap(t => t.extensions),
    requireContentValidation = true,
    sanitizeSvg = true,
    checkForMaliciousPatterns = true
  } = options
  
  const errors: string[] = []
  const warnings: string[] = []
  let sanitizedContent: Buffer | undefined
  
  // Basic validations
  if (file.size > maxSize) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`)
  }
  
  if (file.size === 0) {
    errors.push('File is empty')
  }
  
  // Check file extension
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
    errors.push(`File extension '${fileExtension}' is not allowed`)
  }
  
  // Check MIME type (preliminary check)
  if (!allowedTypes.includes(file.type)) {
    warnings.push(`MIME type '${file.type}' is not in allowed list, will verify with content validation`)
  }
  
  // Content validation
  let detectedType: string | undefined
  let detectedExtension: string | undefined
  
  if (requireContentValidation) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Validate actual file content
      const contentValidation = await validateFileContent(buffer)
      detectedType = contentValidation.detectedType
      detectedExtension = contentValidation.detectedExtension
      
      if (!contentValidation.isValid) {
        errors.push('File content does not match any allowed image format')
      } else if (detectedType !== file.type) {
        warnings.push(`MIME type mismatch: declared '${file.type}', detected '${detectedType}'`)
      }
      
      // Check for malicious patterns
      if (checkForMaliciousPatterns) {
        const maliciousWarnings = checkMaliciousPatterns(buffer)
        warnings.push(...maliciousWarnings)
      }
      
      // SVG sanitization
      if (sanitizeSvg && (detectedType === 'image/svg+xml' || file.type === 'image/svg+xml')) {
        try {
          sanitizedContent = sanitizeSvgContent(buffer)
          warnings.push('SVG content has been sanitized for security')
        } catch (error) {
          errors.push('Failed to sanitize SVG content - upload rejected for security')
        }
      } else {
        sanitizedContent = buffer
      }
      
    } catch (error) {
      errors.push(`Failed to validate file content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    detectedType,
    detectedExtension,
    errors,
    warnings,
    sanitizedContent
  }
}
