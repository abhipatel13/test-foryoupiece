import { container, TYPES } from './container';

// Infrastructure
import { SupabaseUserRepository } from '@/infrastructure/repositories/SupabaseUserRepository';
import { SupabaseProductRepository } from '@/infrastructure/repositories/SupabaseProductRepository';

// Application Services
import { ProductService } from '@/application/services/ProductService';

// Use Cases
import { LoginUser } from '@/application/use-cases/auth/LoginUser';
import { RegisterUser } from '@/application/use-cases/auth/RegisterUser';
import { GetProducts } from '@/application/use-cases/products/GetProducts';
import { GetProduct } from '@/application/use-cases/products/GetProduct';

/**
 * Service Registry
 * Configures and registers all application dependencies
 */
export class ServiceRegistry {
  private static isInitialized = false;

  /**
   * Initialize all service dependencies
   */
  static initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.registerRepositories();
    this.registerServices();
    this.registerUseCases();

    this.isInitialized = true;
  }

  /**
   * Register repository implementations
   */
  private static registerRepositories(): void {
    // User Repository
    container.registerClass(
      TYPES.UserRepository,
      SupabaseUserRepository,
      []
    );

    // Product Repository
    container.registerClass(
      TYPES.ProductRepository,
      SupabaseProductRepository,
      []
    );
  }

  /**
   * Register application services
   */
  private static registerServices(): void {
    // Product Service
    container.registerClass(
      TYPES.ProductService,
      ProductService,
      []
    );
  }

  /**
   * Register use cases
   */
  private static registerUseCases(): void {
    // Auth Use Cases
    container.registerClass(
      TYPES.LoginUser,
      LoginUser,
      [TYPES.UserRepository, TYPES.AuthService]
    );

    container.registerClass(
      TYPES.RegisterUser,
      RegisterUser,
      [TYPES.UserRepository, TYPES.AuthService]
    );

    // Product Use Cases
    container.registerClass(
      TYPES.GetProducts,
      GetProducts,
      [TYPES.ProductRepository]
    );

    container.registerClass(
      TYPES.GetProduct,
      GetProduct,
      [TYPES.ProductRepository]
    );
  }

  /**
   * Get a service instance
   */
  static get<T>(identifier: symbol): T {
    this.initialize();
    return container.resolve<T>(identifier);
  }

  /**
   * Reset the container (useful for testing)
   */
  static reset(): void {
    container.clear();
    this.isInitialized = false;
  }
}

// Convenience functions for common services
export const getProductService = (): ProductService => 
  ServiceRegistry.get<ProductService>(TYPES.ProductService);

export const getUserRepository = () => 
  ServiceRegistry.get(TYPES.UserRepository);

export const getProductRepository = () => 
  ServiceRegistry.get(TYPES.ProductRepository);
