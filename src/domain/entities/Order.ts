import { BaseEntity, ID, Timestamp, ValidationError } from '@/shared/types/common';
import { OrderStatus, PaymentStatus, ORDER_STATUS, PAYMENT_STATUS } from '@/shared/constants';
import { Price, OrderNumber } from '../value-objects';

export interface OrderItemProps {
  id: ID;
  product_id: ID;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderProps {
  id: ID;
  order_number: string;
  user_id: ID;
  customer_email: string;
  customer_name?: string;
  items: OrderItemProps[];
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  total_amount: number;
  payment_status: PaymentStatus;
  fulfillment_status: OrderStatus;
  shipping_address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  billing_address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * OrderItem value object
 */
export class OrderItem {
  private _id: ID;
  private _productId: ID;
  private _productName: string;
  private _productSku: string;
  private _quantity: number;
  private _unitPrice: Price;
  private _totalPrice: Price;

  constructor(props: OrderItemProps) {
    this._id = props.id;
    this._productId = props.product_id;
    this._productName = props.product_name;
    this._productSku = props.product_sku;
    this._quantity = props.quantity;
    this._unitPrice = Price.create(props.unit_price);
    this._totalPrice = Price.create(props.total_price);

    this.validate();
  }

  private validate(): void {
    if (this._quantity <= 0) {
      throw new ValidationError('Order item quantity must be positive');
    }

    const expectedTotal = this._unitPrice.multiply(this._quantity);
    if (!this._totalPrice.equals(expectedTotal)) {
      throw new ValidationError('Order item total price does not match unit price × quantity');
    }
  }

  get id(): ID { return this._id; }
  get productId(): ID { return this._productId; }
  get productName(): string { return this._productName; }
  get productSku(): string { return this._productSku; }
  get quantity(): number { return this._quantity; }
  get unitPrice(): Price { return this._unitPrice; }
  get totalPrice(): Price { return this._totalPrice; }

  toPlainObject(): OrderItemProps {
    return {
      id: this._id,
      product_id: this._productId,
      product_name: this._productName,
      product_sku: this._productSku,
      quantity: this._quantity,
      unit_price: this._unitPrice.value,
      total_price: this._totalPrice.value,
    };
  }
}

/**
 * Order domain entity
 */
export class Order implements BaseEntity {
  private _id: ID;
  private _orderNumber: OrderNumber;
  private _userId: ID;
  private _customerEmail: string;
  private _customerName?: string;
  private _items: OrderItem[];
  private _subtotal: Price;
  private _taxAmount: Price;
  private _shippingAmount: Price;
  private _discountAmount: Price;
  private _totalAmount: Price;
  private _paymentStatus: PaymentStatus;
  private _fulfillmentStatus: OrderStatus;
  private _shippingAddress?: any;
  private _billingAddress?: any;
  private _notes?: string;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  constructor(props: OrderProps) {
    this._id = props.id;
    this._orderNumber = OrderNumber.create(props.order_number);
    this._userId = props.user_id;
    this._customerEmail = props.customer_email;
    this._customerName = props.customer_name;
    this._items = props.items.map(item => new OrderItem(item));
    this._subtotal = Price.create(props.subtotal);
    this._taxAmount = Price.create(props.tax_amount || 0);
    this._shippingAmount = Price.create(props.shipping_amount || 0);
    this._discountAmount = Price.create(props.discount_amount || 0);
    this._totalAmount = Price.create(props.total_amount);
    this._paymentStatus = props.payment_status;
    this._fulfillmentStatus = props.fulfillment_status;
    this._shippingAddress = props.shipping_address;
    this._billingAddress = props.billing_address;
    this._notes = props.notes;
    this._createdAt = props.created_at;
    this._updatedAt = props.updated_at;

    this.validate();
  }

  private validate(): void {
    if (!this._id) {
      throw new ValidationError('Order ID is required');
    }

    if (!this._userId) {
      throw new ValidationError('User ID is required');
    }

    if (!this._customerEmail) {
      throw new ValidationError('Customer email is required');
    }

    if (this._items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    if (!Object.values(PAYMENT_STATUS).includes(this._paymentStatus)) {
      throw new ValidationError('Invalid payment status');
    }

    if (!Object.values(ORDER_STATUS).includes(this._fulfillmentStatus)) {
      throw new ValidationError('Invalid fulfillment status');
    }

    // Validate total calculation
    const calculatedSubtotal = this._items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      Price.zero()
    );

    if (!this._subtotal.equals(calculatedSubtotal)) {
      throw new ValidationError('Order subtotal does not match sum of item totals');
    }

    const calculatedTotal = this._subtotal
      .add(this._taxAmount)
      .add(this._shippingAmount)
      .subtract(this._discountAmount);

    if (!this._totalAmount.equals(calculatedTotal)) {
      throw new ValidationError('Order total does not match calculated total');
    }
  }

  // Getters
  get id(): ID { return this._id; }
  get orderNumber(): OrderNumber { return this._orderNumber; }
  get userId(): ID { return this._userId; }
  get customerEmail(): string { return this._customerEmail; }
  get customerName(): string | undefined { return this._customerName; }
  get items(): OrderItem[] { return [...this._items]; }
  get subtotal(): Price { return this._subtotal; }
  get taxAmount(): Price { return this._taxAmount; }
  get shippingAmount(): Price { return this._shippingAmount; }
  get discountAmount(): Price { return this._discountAmount; }
  get totalAmount(): Price { return this._totalAmount; }
  get paymentStatus(): PaymentStatus { return this._paymentStatus; }
  get fulfillmentStatus(): OrderStatus { return this._fulfillmentStatus; }
  get shippingAddress(): any { return this._shippingAddress; }
  get billingAddress(): any { return this._billingAddress; }
  get notes(): string | undefined { return this._notes; }
  get created_at(): Timestamp { return this._createdAt; }
  get updated_at(): Timestamp { return this._updatedAt; }

  // Business methods
  updatePaymentStatus(status: PaymentStatus): void {
    if (!Object.values(PAYMENT_STATUS).includes(status)) {
      throw new ValidationError('Invalid payment status');
    }

    // Business rules for payment status transitions
    if (this._paymentStatus === PAYMENT_STATUS.VERIFIED && status === PAYMENT_STATUS.PENDING) {
      throw new ValidationError('Cannot change payment status from verified to pending');
    }

    this._paymentStatus = status;
    this._updatedAt = new Date().toISOString();
  }

  updateFulfillmentStatus(status: OrderStatus): void {
    if (!Object.values(ORDER_STATUS).includes(status)) {
      throw new ValidationError('Invalid fulfillment status');
    }

    // Business rules for fulfillment status transitions
    if (this._fulfillmentStatus === ORDER_STATUS.DELIVERED && status !== ORDER_STATUS.DELIVERED) {
      throw new ValidationError('Cannot change status of delivered order');
    }

    if (this._fulfillmentStatus === ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.CANCELLED) {
      throw new ValidationError('Cannot change status of cancelled order');
    }

    this._fulfillmentStatus = status;
    this._updatedAt = new Date().toISOString();
  }

  cancel(): void {
    if (this._fulfillmentStatus === ORDER_STATUS.DELIVERED) {
      throw new ValidationError('Cannot cancel delivered order');
    }

    if (this._fulfillmentStatus === ORDER_STATUS.SHIPPED) {
      throw new ValidationError('Cannot cancel shipped order');
    }

    this._fulfillmentStatus = ORDER_STATUS.CANCELLED;
    this._updatedAt = new Date().toISOString();
  }

  canBeCancelled(): boolean {
    return this._fulfillmentStatus !== ORDER_STATUS.DELIVERED &&
           this._fulfillmentStatus !== ORDER_STATUS.SHIPPED &&
           this._fulfillmentStatus !== ORDER_STATUS.CANCELLED;
  }

  isPaymentVerified(): boolean {
    return this._paymentStatus === PAYMENT_STATUS.VERIFIED;
  }

  isFulfilled(): boolean {
    return this._fulfillmentStatus === ORDER_STATUS.DELIVERED;
  }

  getTotalItemCount(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  equals(other: Order): boolean {
    return this._id === other._id;
  }

  // Factory methods
  static create(props: Omit<OrderProps, 'id' | 'order_number' | 'created_at' | 'updated_at'>): Order {
    const now = new Date().toISOString();
    return new Order({
      ...props,
      id: crypto.randomUUID(),
      order_number: OrderNumber.generate().value,
      created_at: now,
      updated_at: now,
    });
  }

  static fromPersistence(props: OrderProps): Order {
    return new Order(props);
  }

  // Serialization
  toPlainObject(): OrderProps {
    return {
      id: this._id,
      order_number: this._orderNumber.value,
      user_id: this._userId,
      customer_email: this._customerEmail,
      customer_name: this._customerName,
      items: this._items.map(item => item.toPlainObject()),
      subtotal: this._subtotal.value,
      tax_amount: this._taxAmount.value,
      shipping_amount: this._shippingAmount.value,
      discount_amount: this._discountAmount.value,
      total_amount: this._totalAmount.value,
      payment_status: this._paymentStatus,
      fulfillment_status: this._fulfillmentStatus,
      shipping_address: this._shippingAddress,
      billing_address: this._billingAddress,
      notes: this._notes,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
