import { Result, ValidationError, UnauthorizedError } from '@/shared/types/common';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@/domain/entities/User';
import { Email } from '@/domain/value-objects/Email';

export interface LoginUserRequest {
  email: string;
  password: string;
}

export interface LoginUserResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Login User Use Case
 * Handles user authentication and login
 */
export class LoginUser {
  constructor(
    private userRepository: IUserRepository,
    private authService: any // TODO: Define proper auth service interface
  ) {}

  async execute(request: LoginUserRequest): Promise<Result<LoginUserResponse>> {
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

      // Find user by email
      const userResult = await this.userRepository.findByEmail(email);
      if (!userResult.success) {
        return { success: false, error: userResult.error };
      }

      if (!userResult.data) {
        return {
          success: false,
          error: new UnauthorizedError('Invalid email or password')
        };
      }

      const user = userResult.data;

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          error: new UnauthorizedError('Account is deactivated')
        };
      }

      // Authenticate with external service (Supabase Auth)
      const authResult = await this.authService.signInWithPassword(
        request.email,
        request.password
      );

      if (!authResult.success) {
        return {
          success: false,
          error: new UnauthorizedError('Invalid email or password')
        };
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      return {
        success: true,
        data: {
          user,
          accessToken: authResult.data.access_token,
          refreshToken: authResult.data.refresh_token,
        }
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        return { success: false, error };
      }
      return {
        success: false,
        error: new Error('An unexpected error occurred during login')
      };
    }
  }
}
