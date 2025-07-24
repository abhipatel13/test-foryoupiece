/**
 * Common types used across the application
 */

export type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

export type Optional<T> = T | null | undefined;

export type ID = string;

export type Timestamp = string;

export interface BaseEntity {
  id: ID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface FilterParams {
  [key: string]: any;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryParams extends PaginationParams {
  filters?: FilterParams;
  sort?: SortParams;
}

// Domain Events
export interface DomainEvent {
  id: ID;
  type: string;
  aggregateId: ID;
  aggregateType: string;
  data: any;
  timestamp: Timestamp;
}

// Error types
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}
