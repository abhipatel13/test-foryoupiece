import { ValidationError } from '@/shared/types/common';

/**
 * Points value object for loyalty points system
 */
export class Points {
  private readonly _value: number;

  constructor(value: number) {
    this._value = this.validate(value);
  }

  private validate(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError('Points must be a valid number');
    }

    if (value < 0) {
      throw new ValidationError('Points cannot be negative');
    }

    if (!Number.isInteger(value)) {
      throw new ValidationError('Points must be a whole number');
    }

    if (value > 999999) {
      throw new ValidationError('Points cannot exceed 999,999');
    }

    return value;
  }

  get value(): number {
    return this._value;
  }

  add(other: Points): Points {
    return new Points(this._value + other._value);
  }

  subtract(other: Points): Points {
    const result = this._value - other._value;
    if (result < 0) {
      throw new ValidationError('Insufficient points');
    }
    return new Points(result);
  }

  multiply(factor: number): Points {
    return new Points(Math.floor(this._value * factor));
  }

  equals(other: Points): boolean {
    return this._value === other._value;
  }

  isGreaterThan(other: Points): boolean {
    return this._value > other._value;
  }

  isLessThan(other: Points): boolean {
    return this._value < other._value;
  }

  isGreaterThanOrEqual(other: Points): boolean {
    return this._value >= other._value;
  }

  canAfford(cost: Points): boolean {
    return this._value >= cost._value;
  }

  format(): string {
    return new Intl.NumberFormat('en-US').format(this._value);
  }

  toString(): string {
    return this._value.toString();
  }

  static create(value: number): Points {
    return new Points(value);
  }

  static zero(): Points {
    return new Points(0);
  }

  static fromPurchase(amount: number, rate: number = 0.01): Points {
    // Default: 1 point per dollar spent
    const points = Math.floor(amount * rate);
    return new Points(points);
  }

  static isValid(value: number): boolean {
    try {
      new Points(value);
      return true;
    } catch {
      return false;
    }
  }
}
