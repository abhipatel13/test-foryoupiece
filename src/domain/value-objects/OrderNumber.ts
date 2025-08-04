import { ValidationError } from '@/shared/types/common';

/**
 * OrderNumber value object for unique order identification
 */
export class OrderNumber {
  private readonly _value: string;

  constructor(value: string) {
    this._value = this.validate(value);
  }

  private validate(value: string): string {
    if (!value) {
      throw new ValidationError('Order number is required');
    }

    const trimmed = value.trim().toUpperCase();

    if (trimmed.length < 6 || trimmed.length > 20) {
      throw new ValidationError('Order number must be between 6 and 20 characters');
    }

    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      throw new ValidationError('Order number can only contain letters, numbers, and hyphens');
    }

    return trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrderNumber): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(value: string): OrderNumber {
    return new OrderNumber(value);
  }

  static generate(): OrderNumber {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const orderNumber = `FYP-${year}${month}${day}-${timestamp}-${random}`;
    return new OrderNumber(orderNumber);
  }

  static isValid(value: string): boolean {
    try {
      new OrderNumber(value);
      return true;
    } catch {
      return false;
    }
  }
}
