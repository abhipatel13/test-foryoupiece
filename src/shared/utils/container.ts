/**
 * Simple Dependency Injection Container
 * Manages service instances and their dependencies
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type ServiceFactory<T> = () => T;
type ServiceIdentifier<T> = string | symbol | Constructor<T>;

interface ServiceDefinition<T> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
}

export class Container {
  private services = new Map<ServiceIdentifier<any>, ServiceDefinition<any>>();

  /**
   * Register a service with the container
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean } = {}
  ): void {
    this.services.set(identifier, {
      factory,
      singleton: options.singleton ?? true,
    });
  }

  /**
   * Register a class constructor as a service
   */
  registerClass<T>(
    identifier: ServiceIdentifier<T>,
    constructor: Constructor<T>,
    dependencies: ServiceIdentifier<any>[] = [],
    options: { singleton?: boolean } = {}
  ): void {
    const factory = () => {
      const deps = dependencies.map(dep => this.resolve(dep));
      return new constructor(...deps);
    };

    this.register(identifier, factory, options);
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void {
    this.services.set(identifier, {
      factory: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    const serviceDefinition = this.services.get(identifier);

    if (!serviceDefinition) {
      throw new Error(`Service not found: ${String(identifier)}`);
    }

    if (serviceDefinition.singleton) {
      if (!serviceDefinition.instance) {
        serviceDefinition.instance = serviceDefinition.factory();
      }
      return serviceDefinition.instance;
    }

    return serviceDefinition.factory();
  }

  /**
   * Check if a service is registered
   */
  has<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.has(identifier);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Create a child container that inherits from this one
   */
  createChild(): Container {
    const child = new Container();
    // Copy parent services
    for (const [identifier, definition] of this.services.entries()) {
      child.services.set(identifier, { ...definition });
    }
    return child;
  }
}

// Global container instance
export const container = new Container();

// Service identifiers (symbols for type safety)
export const TYPES = {
  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  ProductRepository: Symbol.for('ProductRepository'),
  OrderRepository: Symbol.for('OrderRepository'),
  CategoryRepository: Symbol.for('CategoryRepository'),

  // Services
  ProductService: Symbol.for('ProductService'),
  UserService: Symbol.for('UserService'),
  OrderService: Symbol.for('OrderService'),
  AuthService: Symbol.for('AuthService'),

  // Use Cases
  LoginUser: Symbol.for('LoginUser'),
  RegisterUser: Symbol.for('RegisterUser'),
  GetProducts: Symbol.for('GetProducts'),
  GetProduct: Symbol.for('GetProduct'),

  // External Services
  SupabaseClient: Symbol.for('SupabaseClient'),
  BoxHeroService: Symbol.for('BoxHeroService'),
  TelegramService: Symbol.for('TelegramService'),
} as const;
