import { ValidationError } from '@/shared/types/common';
import { VALIDATION_RULES, ERROR_MESSAGES } from '@/shared/constants';

/**
 * SKU (Stock Keeping Unit) value object with validation
 */
export class SKU {
  private readonly _value: string;

  constructor(value: string) {
    this._value = this.validate(value);
  }

  private validate(value: string): string {
    if (!value) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.REQUIRED);
    }

    const trimmed = value.trim().toUpperCase();

    if (trimmed.length < VALIDATION_RULES.SKU.MIN_LENGTH) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_SKU);
    }

    if (trimmed.length > VALIDATION_RULES.SKU.MAX_LENGTH) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_SKU);
    }

    if (!VALIDATION_RULES.SKU.PATTERN.test(trimmed)) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_SKU);
    }

    return trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: SKU): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(value: string): SKU {
    return new SKU(value);
  }

  static generate(prefix?: string): SKU {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const sku = prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    return new SKU(sku.toUpperCase());
  }

  static isValid(value: string): boolean {
    try {
      new SKU(value);
      return true;
    } catch {
      return false;
    }
  }
}
