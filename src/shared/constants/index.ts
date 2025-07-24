/**
 * Application constants
 */

export const APP_CONFIG = {
  NAME: 'ForYouPiece',
  VERSION: '1.0.0',
  DESCRIPTION: 'E-commerce platform with clean architecture',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const ORDER_STATUS = {
  PENDING: 'pending',
  ON_HOLD: 'on_hold',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
} as const;

export const VALIDATION_RULES = {
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]/,
  },
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  PRICE: {
    MIN: 0,
    MAX: 999999.99,
  },
  SKU: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[A-Z0-9-_]+$/,
  },
  STOCK: {
    MIN: 0,
    MAX: 999999,
  },
} as const;

export const ERROR_MESSAGES = {
  VALIDATION: {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and number',
    INVALID_PRICE: 'Price must be a positive number',
    INVALID_SKU: 'SKU must contain only uppercase letters, numbers, hyphens, and underscores',
    INVALID_STOCK: 'Stock quantity must be a non-negative integer',
  },
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    SESSION_EXPIRED: 'Your session has expired. Please log in again',
  },
  PRODUCT: {
    NOT_FOUND: 'Product not found',
    OUT_OF_STOCK: 'Available for preorder',
    INSUFFICIENT_STOCK: 'Insufficient stock available',
  },
  ORDER: {
    NOT_FOUND: 'Order not found',
    CANNOT_CANCEL: 'Order cannot be cancelled at this stage',
    INVALID_STATUS: 'Invalid order status',
  },
  GENERAL: {
    NETWORK_ERROR: 'Network error. Please try again',
    SERVER_ERROR: 'Server error. Please try again later',
    UNKNOWN_ERROR: 'An unknown error occurred',
  },
} as const;

export const EVENTS = {
  USER: {
    REGISTERED: 'user.registered',
    UPDATED: 'user.updated',
    DELETED: 'user.deleted',
  },
  PRODUCT: {
    CREATED: 'product.created',
    UPDATED: 'product.updated',
    DELETED: 'product.deleted',
    STOCK_UPDATED: 'product.stock_updated',
  },
  ORDER: {
    CREATED: 'order.created',
    UPDATED: 'order.updated',
    CANCELLED: 'order.cancelled',
    SHIPPED: 'order.shipped',
    DELIVERED: 'order.delivered',
  },
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type ProductStatus = typeof PRODUCT_STATUS[keyof typeof PRODUCT_STATUS];
