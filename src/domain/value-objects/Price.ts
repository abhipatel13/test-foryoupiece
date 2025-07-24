import { ValidationError } from '@/shared/types/common';
import { VALIDATION_RULES, ERROR_MESSAGES } from '@/shared/constants';

/**
 * Price value object with validation and formatting
 */
export class Price {
  private readonly _value: number;
  private readonly _currency: string;

  constructor(value: number, currency: string = 'USD') {
    this._value = this.validate(value);
    this._currency = currency;
  }

  private validate(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_PRICE);
    }

    if (value < VALIDATION_RULES.PRICE.MIN) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_PRICE);
    }

    if (value > VALIDATION_RULES.PRICE.MAX) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_PRICE);
    }

    // Round to 2 decimal places
    return Math.round(value * 100) / 100;
  }

  get value(): number {
    return this._value;
  }

  get currency(): string {
    return this._currency;
  }

  add(other: Price): Price {
    if (this._currency !== other._currency) {
      throw new ValidationError('Cannot add prices with different currencies');
    }
    return new Price(this._value + other._value, this._currency);
  }

  subtract(other: Price): Price {
    if (this._currency !== other._currency) {
      throw new ValidationError('Cannot subtract prices with different currencies');
    }
    return new Price(this._value - other._value, this._currency);
  }

  multiply(factor: number): Price {
    return new Price(this._value * factor, this._currency);
  }

  equals(other: Price): boolean {
    return this._value === other._value && this._currency === other._currency;
  }

  isGreaterThan(other: Price): boolean {
    if (this._currency !== other._currency) {
      throw new ValidationError('Cannot compare prices with different currencies');
    }
    return this._value > other._value;
  }

  isLessThan(other: Price): boolean {
    if (this._currency !== other._currency) {
      throw new ValidationError('Cannot compare prices with different currencies');
    }
    return this._value < other._value;
  }

  format(): string {
    // Use en-US locale for USD formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this._currency,
    }).format(this._value);
  }

  toString(): string {
    return this.format();
  }

  static create(value: number, currency?: string): Price {
    return new Price(value, currency);
  }

  static zero(currency: string = 'JPY'): Price {
    return new Price(0, currency);
  }

  static isValid(value: number): boolean {
    try {
      new Price(value);
      return true;
    } catch {
      return false;
    }
  }
}
