import { Result, ValidationError, ConflictError } from '@/shared/types/common';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@/domain/entities/User';
import { Email } from '@/domain/value-objects/Email';
import { Points } from '@/domain/value-objects/Points';

export interface RegisterUserRequest {
  email: string;
  password: string;
  name?: string;
  avatarUrl?: string;
}

export interface RegisterUserResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register User Use Case
 * Handles user registration and account creation
 */
export class RegisterUser {
  constructor(
    private userRepository: IUserRepository,
    private authService: any // TODO: Define proper auth service interface
  ) {}

  async execute(request: RegisterUserRequest): Promise<Result<RegisterUserResponse>> {
    try {
      // Validate input
      if (!request.email || !request.password) {
        return {
          success: false,
          error: new ValidationError('Email and password are required')
        };
      }

      // Create email value object
      const email = Email.create(request.email);

      // Check if user already exists
      const existsResult = await this.userRepository.existsByEmail(email);
      if (!existsResult.success) {
        return { success: false, error: existsResult.error };
      }

      if (existsResult.data) {
        return {
          success: false,
          error: new ConflictError('User with this email already exists')
        };
      }

      // Create user account with external auth service
      const authResult = await this.authService.signUp(
        request.email,
        request.password
      );

      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Create user domain entity
      const user = User.create({
        email: request.email,
        name: request.name,
        avatar_url: request.avatarUrl,
        points: 0, // New users start with 0 points
      });

      // Save user to repository
      const saveResult = await this.userRepository.create(user);
      if (!saveResult.success) {
        // Rollback auth account creation if user creation fails
        await this.authService.deleteUser(authResult.data.user.id);
        return { success: false, error: saveResult.error };
      }

      return {
        success: true,
        data: {
          user: saveResult.data,
          accessToken: authResult.data.session.access_token,
          refreshToken: authResult.data.session.refresh_token,
        }
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        return { success: false, error };
      }
      return {
        success: false,
        error: new Error('An unexpected error occurred during registration')
      };
    }
  }
}
