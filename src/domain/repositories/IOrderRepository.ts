import { Result, ID, PaginatedResult, QueryParams } from '@/shared/types/common';
import { Order } from '../entities/Order';
import { OrderNumber } from '../value-objects/OrderNumber';
import { OrderStatus, PaymentStatus } from '@/shared/constants';

export interface OrderFilters {
  userId?: ID;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  customerEmail?: string;
}

export interface OrderQueryParams extends QueryParams {
  filters?: OrderFilters;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  recentOrders: any[];
}

/**
 * Order repository interface
 * Defines the contract for order data access operations
 */
export interface IOrderRepository {
  /**
   * Find an order by ID
   */
  findById(id: ID): Promise<Result<Order | null>>;

  /**
   * Find an order by order number
   */
  findByOrderNumber(orderNumber: OrderNumber): Promise<Result<Order | null>>;

  /**
   * Find multiple orders with pagination and filtering
   */
  findMany(params?: OrderQueryParams): Promise<Result<PaginatedResult<Order>>>;

  /**
   * Find orders by user ID
   */
  findByUserId(userId: ID, params?: QueryParams): Promise<Result<PaginatedResult<Order>>>;

  /**
   * Get orders by payment status
   */
  findByPaymentStatus(status: PaymentStatus, params?: QueryParams): Promise<Result<PaginatedResult<Order>>>;

  /**
   * Get orders by fulfillment status
   */
  findByFulfillmentStatus(status: OrderStatus, params?: QueryParams): Promise<Result<PaginatedResult<Order>>>;

  /**
   * Create a new order
   */
  create(order: Order): Promise<Result<Order>>;

  /**
   * Update an existing order
   */
  update(order: Order): Promise<Result<Order>>;

  /**
   * Update order payment status
   */
  updatePaymentStatus(id: ID, status: PaymentStatus): Promise<Result<void>>;

  /**
   * Update order fulfillment status
   */
  updateFulfillmentStatus(id: ID, status: OrderStatus): Promise<Result<void>>;

  /**
   * Cancel an order
   */
  cancel(id: ID): Promise<Result<void>>;

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): Promise<Result<DashboardStats>>;

  /**
   * Get recent orders for admin dashboard
   */
  getRecentOrders(limit?: number): Promise<Result<Order[]>>;

  /**
   * Check if order number exists
   */
  existsByOrderNumber(orderNumber: OrderNumber): Promise<Result<boolean>>;
}
