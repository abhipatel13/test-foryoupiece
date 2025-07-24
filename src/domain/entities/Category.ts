import { BaseEntity, ID, Timestamp, ValidationError } from '@/shared/types/common';

export interface CategoryProps {
  id: ID;
  name_en: string;
  name_ja?: string;
  slug: string;
  description_en?: string;
  description_ja?: string;
  image_url?: string;
  parent_id?: ID;
  sort_order: number;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Category domain entity
 */
export class Category implements BaseEntity {
  private _id: ID;
  private _nameEn: string;
  private _nameJa?: string;
  private _slug: string;
  private _descriptionEn?: string;
  private _descriptionJa?: string;
  private _imageUrl?: string;
  private _parentId?: ID;
  private _sortOrder: number;
  private _isActive: boolean;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  constructor(props: CategoryProps) {
    this._id = props.id;
    this._nameEn = props.name_en;
    this._nameJa = props.name_ja;
    this._slug = props.slug;
    this._descriptionEn = props.description_en;
    this._descriptionJa = props.description_ja;
    this._imageUrl = props.image_url;
    this._parentId = props.parent_id;
    this._sortOrder = props.sort_order;
    this._isActive = props.is_active;
    this._createdAt = props.created_at;
    this._updatedAt = props.updated_at;

    this.validate();
  }

  private validate(): void {
    if (!this._id) {
      throw new ValidationError('Category ID is required');
    }

    if (!this._nameEn || this._nameEn.length < 1 || this._nameEn.length > 100) {
      throw new ValidationError('Category name (English) must be between 1 and 100 characters');
    }

    if (!this._slug || this._slug.length < 1 || this._slug.length > 100) {
      throw new ValidationError('Category slug must be between 1 and 100 characters');
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(this._slug)) {
      throw new ValidationError('Category slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (this._sortOrder < 0) {
      throw new ValidationError('Sort order cannot be negative');
    }
  }

  // Getters
  get id(): ID {
    return this._id;
  }

  get nameEn(): string {
    return this._nameEn;
  }

  get nameJa(): string | undefined {
    return this._nameJa;
  }

  get slug(): string {
    return this._slug;
  }

  get descriptionEn(): string | undefined {
    return this._descriptionEn;
  }

  get descriptionJa(): string | undefined {
    return this._descriptionJa;
  }

  get imageUrl(): string | undefined {
    return this._imageUrl;
  }

  get parentId(): ID | undefined {
    return this._parentId;
  }

  get sortOrder(): number {
    return this._sortOrder;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get created_at(): Timestamp {
    return this._createdAt;
  }

  get updated_at(): Timestamp {
    return this._updatedAt;
  }

  // Business methods
  updateBasicInfo(nameEn: string, nameJa?: string, descriptionEn?: string, descriptionJa?: string): void {
    if (!nameEn || nameEn.length < 1 || nameEn.length > 100) {
      throw new ValidationError('Category name (English) must be between 1 and 100 characters');
    }

    this._nameEn = nameEn;
    this._nameJa = nameJa;
    this._descriptionEn = descriptionEn;
    this._descriptionJa = descriptionJa;
    this._updatedAt = new Date().toISOString();
  }

  updateSlug(slug: string): void {
    if (!slug || slug.length < 1 || slug.length > 100) {
      throw new ValidationError('Category slug must be between 1 and 100 characters');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ValidationError('Category slug must contain only lowercase letters, numbers, and hyphens');
    }

    this._slug = slug;
    this._updatedAt = new Date().toISOString();
  }

  updateImage(imageUrl?: string): void {
    this._imageUrl = imageUrl;
    this._updatedAt = new Date().toISOString();
  }

  updateSortOrder(sortOrder: number): void {
    if (sortOrder < 0) {
      throw new ValidationError('Sort order cannot be negative');
    }

    this._sortOrder = sortOrder;
    this._updatedAt = new Date().toISOString();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date().toISOString();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date().toISOString();
  }

  setParent(parentId?: ID): void {
    this._parentId = parentId;
    this._updatedAt = new Date().toISOString();
  }

  isRootCategory(): boolean {
    return !this._parentId;
  }

  isChildOf(categoryId: ID): boolean {
    return this._parentId === categoryId;
  }

  equals(other: Category): boolean {
    return this._id === other._id;
  }

  // Factory methods
  static create(props: Omit<CategoryProps, 'id' | 'created_at' | 'updated_at'>): Category {
    const now = new Date().toISOString();
    return new Category({
      ...props,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });
  }

  static fromPersistence(props: CategoryProps): Category {
    return new Category(props);
  }

  // Utility methods
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  // Serialization
  toPlainObject(): CategoryProps {
    return {
      id: this._id,
      name_en: this._nameEn,
      name_ja: this._nameJa,
      slug: this._slug,
      description_en: this._descriptionEn,
      description_ja: this._descriptionJa,
      image_url: this._imageUrl,
      parent_id: this._parentId,
      sort_order: this._sortOrder,
      is_active: this._isActive,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
