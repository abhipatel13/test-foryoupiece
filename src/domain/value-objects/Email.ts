import { ValidationError } from '@/shared/types/common';
import { VALIDATION_RULES, ERROR_MESSAGES } from '@/shared/constants';

/**
 * Email value object with validation
 */
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    this._value = this.validate(value);
  }

  private validate(value: string): string {
    if (!value) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.REQUIRED);
    }

    const trimmed = value.trim().toLowerCase();

    if (trimmed.length < VALIDATION_RULES.EMAIL.MIN_LENGTH) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL);
    }

    if (trimmed.length > VALIDATION_RULES.EMAIL.MAX_LENGTH) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL);
    }

    if (!VALIDATION_RULES.EMAIL.PATTERN.test(trimmed)) {
      throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL);
    }

    return trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(value: string): Email {
    return new Email(value);
  }

  static isValid(value: string): boolean {
    try {
      new Email(value);
      return true;
    } catch {
      return false;
    }
  }
}
