/**
 * Domain Repository Interfaces
 * 
 * Repository interfaces define the contract for data access operations.
 * They are implemented in the infrastructure layer.
 */

export type { IUserRepository } from './IUserRepository';
export type { IProductRepository, ProductFilters, ProductQueryParams } from './IProductRepository';
export type { IOrderRepository, OrderFilters, OrderQueryParams, DashboardStats } from './IOrderRepository';
export type { ICategoryRepository, CategoryFilters, CategoryQueryParams } from './ICategoryRepository';
