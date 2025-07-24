import { BaseEntity, ID, Timestamp, ValidationError } from '@/shared/types/common';
import { UserRole, USER_ROLES } from '@/shared/constants';
import { Email, Points } from '../value-objects';

export interface UserProps {
  id: ID;
  email: string;
  name?: string;
  avatar_url?: string;
  points?: number;
  role?: UserRole;
  is_active?: boolean;
  last_login_at?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * User domain entity
 */
export class User implements BaseEntity {
  private _id: ID;
  private _email: Email;
  private _name?: string;
  private _avatarUrl?: string;
  private _points: Points;
  private _role: UserRole;
  private _isActive: boolean;
  private _lastLoginAt?: Timestamp;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  constructor(props: UserProps) {
    this._id = props.id;
    this._email = Email.create(props.email);
    this._name = props.name;
    this._avatarUrl = props.avatar_url;
    this._points = Points.create(props.points || 0);
    this._role = props.role || USER_ROLES.USER;
    this._isActive = props.is_active ?? true;
    this._lastLoginAt = props.last_login_at;
    this._createdAt = props.created_at;
    this._updatedAt = props.updated_at;

    this.validate();
  }

  private validate(): void {
    if (!this._id) {
      throw new ValidationError('User ID is required');
    }

    if (this._name && (this._name.length < 1 || this._name.length > 100)) {
      throw new ValidationError('Name must be between 1 and 100 characters');
    }

    if (!Object.values(USER_ROLES).includes(this._role)) {
      throw new ValidationError('Invalid user role');
    }
  }

  // Getters
  get id(): ID {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get name(): string | undefined {
    return this._name;
  }

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  get points(): Points {
    return this._points;
  }

  get role(): UserRole {
    return this._role;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get lastLoginAt(): Timestamp | undefined {
    return this._lastLoginAt;
  }

  get created_at(): Timestamp {
    return this._createdAt;
  }

  get updated_at(): Timestamp {
    return this._updatedAt;
  }

  // Business methods
  updateProfile(name?: string, avatarUrl?: string): void {
    if (name !== undefined) {
      if (name.length < 1 || name.length > 100) {
        throw new ValidationError('Name must be between 1 and 100 characters');
      }
      this._name = name;
    }

    if (avatarUrl !== undefined) {
      this._avatarUrl = avatarUrl;
    }

    this._updatedAt = new Date().toISOString();
  }

  addPoints(points: Points): void {
    this._points = this._points.add(points);
    this._updatedAt = new Date().toISOString();
  }

  spendPoints(points: Points): void {
    if (!this._points.canAfford(points)) {
      throw new ValidationError('Insufficient points');
    }
    this._points = this._points.subtract(points);
    this._updatedAt = new Date().toISOString();
  }

  updateLastLogin(): void {
    this._lastLoginAt = new Date().toISOString();
    this._updatedAt = new Date().toISOString();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date().toISOString();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date().toISOString();
  }

  changeRole(role: UserRole): void {
    if (!Object.values(USER_ROLES).includes(role)) {
      throw new ValidationError('Invalid user role');
    }
    this._role = role;
    this._updatedAt = new Date().toISOString();
  }

  isAdmin(): boolean {
    return this._role === USER_ROLES.ADMIN || this._role === USER_ROLES.SUPER_ADMIN;
  }

  isSuperAdmin(): boolean {
    return this._role === USER_ROLES.SUPER_ADMIN;
  }

  equals(other: User): boolean {
    return this._id === other._id;
  }

  // Factory methods
  static create(props: Omit<UserProps, 'id' | 'created_at' | 'updated_at'>): User {
    const now = new Date().toISOString();
    return new User({
      ...props,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  // Serialization
  toPlainObject(): UserProps {
    return {
      id: this._id,
      email: this._email.value,
      name: this._name,
      avatar_url: this._avatarUrl,
      points: this._points.value,
      role: this._role,
      is_active: this._isActive,
      last_login_at: this._lastLoginAt,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
