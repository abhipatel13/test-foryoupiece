import { Result, ID, PaginatedResult, QueryParams } from '@/shared/types/common';
import { User } from '../entities/User';
import { Email } from '../value-objects/Email';

/**
 * User repository interface
 * Defines the contract for user data access operations
 */
export interface IUserRepository {
  /**
   * Find a user by ID
   */
  findById(id: ID): Promise<Result<User | null>>;

  /**
   * Find a user by email
   */
  findByEmail(email: Email): Promise<Result<User | null>>;

  /**
   * Find multiple users with pagination and filtering
   */
  findMany(params?: QueryParams): Promise<Result<PaginatedResult<User>>>;

  /**
   * Create a new user
   */
  create(user: User): Promise<Result<User>>;

  /**
   * Update an existing user
   */
  update(user: User): Promise<Result<User>>;

  /**
   * Delete a user (soft delete)
   */
  delete(id: ID): Promise<Result<void>>;

  /**
   * Check if a user exists by email
   */
  existsByEmail(email: Email): Promise<Result<boolean>>;

  /**
   * Get user's point transaction history
   */
  getPointTransactions(userId: ID, limit?: number): Promise<Result<any[]>>;

  /**
   * Update user's last login timestamp
   */
  updateLastLogin(id: ID): Promise<Result<void>>;
}
