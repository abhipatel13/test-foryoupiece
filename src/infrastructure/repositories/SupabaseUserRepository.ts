import { createClient } from '@/lib/supabase/client';
import { Result, ID, PaginatedResult, QueryParams, NotFoundError, DomainError } from '@/shared/types/common';
import { PAGINATION } from '@/shared/constants';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User, UserProps } from '@/domain/entities/User';
import { Email } from '@/domain/value-objects/Email';

/**
 * Supabase implementation of IUserRepository
 */
export class SupabaseUserRepository implements IUserRepository {
  private supabase = createClient();

  async findById(id: ID): Promise<Result<User | null>> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw new DomainError('Failed to find user by ID', 'DATABASE_ERROR', error);
      }

      if (!data) {
        return { success: true, data: null };
      }

      const user = User.fromPersistence(data as UserProps);
      return { success: true, data: user };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding user', 'UNKNOWN_ERROR', error) };
    }
  }

  async findByEmail(email: Email): Promise<Result<User | null>> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email.value)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw new DomainError('Failed to find user by email', 'DATABASE_ERROR', error);
      }

      if (!data) {
        return { success: true, data: null };
      }

      const user = User.fromPersistence(data as UserProps);
      return { success: true, data: user };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding user by email', 'UNKNOWN_ERROR', error) };
    }
  }

  async findMany(params?: QueryParams): Promise<Result<PaginatedResult<User>>> {
    try {
      const limit = params?.limit || PAGINATION.DEFAULT_LIMIT;
      const offset = params?.offset || PAGINATION.DEFAULT_OFFSET;

      let query = this.supabase
        .from('users')
        .select('*', { count: 'exact' });

      // Apply filters
      if (params?.filters) {
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply sorting
      if (params?.sort) {
        query = query.order(params.sort.field, { ascending: params.sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new DomainError('Failed to find users', 'DATABASE_ERROR', error);
      }

      const users = (data || []).map(item => User.fromPersistence(item as UserProps));
      const total = count || 0;
      const hasMore = offset + limit < total;

      return {
        success: true,
        data: {
          data: users,
          total,
          hasMore,
        },
      };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding users', 'UNKNOWN_ERROR', error) };
    }
  }

  async create(user: User): Promise<Result<User>> {
    try {
      const userData = user.toPlainObject();
      const { data, error } = await this.supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        throw new DomainError('Failed to create user', 'DATABASE_ERROR', error);
      }

      const createdUser = User.fromPersistence(data as UserProps);
      return { success: true, data: createdUser };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error creating user', 'UNKNOWN_ERROR', error) };
    }
  }

  async update(user: User): Promise<Result<User>> {
    try {
      const userData = user.toPlainObject();
      const { data, error } = await this.supabase
        .from('users')
        .update(userData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        throw new DomainError('Failed to update user', 'DATABASE_ERROR', error);
      }

      const updatedUser = User.fromPersistence(data as UserProps);
      return { success: true, data: updatedUser };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error updating user', 'UNKNOWN_ERROR', error) };
    }
  }

  async delete(id: ID): Promise<Result<void>> {
    try {
      // Soft delete by setting is_active to false
      const { error } = await this.supabase
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new DomainError('Failed to delete user', 'DATABASE_ERROR', error);
      }

      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error deleting user', 'UNKNOWN_ERROR', error) };
    }
  }

  async existsByEmail(email: Email): Promise<Result<boolean>> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email.value)
        .limit(1);

      if (error) {
        throw new DomainError('Failed to check if user exists', 'DATABASE_ERROR', error);
      }

      return { success: true, data: (data?.length || 0) > 0 };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error checking user existence', 'UNKNOWN_ERROR', error) };
    }
  }

  async getPointTransactions(userId: ID, limit = 50): Promise<Result<any[]>> {
    try {
      const { data, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new DomainError('Failed to get point transactions', 'DATABASE_ERROR', error);
      }

      return { success: true, data: data || [] };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error getting point transactions', 'UNKNOWN_ERROR', error) };
    }
  }

  async updateLastLogin(id: ID): Promise<Result<void>> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new DomainError('Failed to update last login', 'DATABASE_ERROR', error);
      }

      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error updating last login', 'UNKNOWN_ERROR', error) };
    }
  }
}
