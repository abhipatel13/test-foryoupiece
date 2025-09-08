import { BaseEntity, ID, Timestamp, ValidationError } from '@/shared/types/common';
import { ProductStatus, PRODUCT_STATUS } from '@/shared/constants';
import { Price, SKU } from '../value-objects';

export interface ProductProps {
  id: ID;
  sku: string;
  name_en: string;
  name_ja?: string;
  description_en?: string;
  description_ja?: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  low_stock_threshold?: number;
  category_id?: ID;
  image_urls?: string[];
  is_featured?: boolean;
  is_active?: boolean;
  status?: ProductStatus;
  weight?: number;
  brand?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Product domain entity
 */
export class Product implements BaseEntity {
  private _id: ID;
  private _sku: SKU;
  private _nameEn: string;
  private _nameJa?: string;
  private _descriptionEn?: string;
  private _descriptionJa?: string;
  private _price: Price;
  private _costPrice?: Price;
  private _stockQuantity: number;
  private _lowStockThreshold: number;
  private _categoryId?: ID;
  private _imageUrls: string[];
  private _isFeatured: boolean;
  private _isActive: boolean;
  private _status: ProductStatus;
  private _weight?: number;
  private _dimensions?: { length: number; width: number; height: number };
  private _brand?: string;
  private _tags: string[];
  private _metadata: Record<string, any>;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  constructor(props: ProductProps) {
    this._id = props.id;
    this._sku = SKU.create(props.sku);
    this._nameEn = props.name_en;
    this._nameJa = props.name_ja;
    this._descriptionEn = props.description_en;
    this._descriptionJa = props.description_ja;
    this._price = Price.create(props.price);
    this._costPrice = props.cost_price ? Price.create(props.cost_price) : undefined;
    this._stockQuantity = props.stock_quantity;
    this._lowStockThreshold = props.low_stock_threshold || 10;
    this._categoryId = props.category_id;
    this._imageUrls = props.image_urls || [];
    this._isFeatured = props.is_featured || false;
    this._isActive = props.is_active ?? true;
    this._status = props.status || PRODUCT_STATUS.ACTIVE;
    this._weight = props.weight;
    this._dimensions = props.dimensions;
    this._brand = props.brand;
    this._tags = props.tags || [];
    this._metadata = props.metadata || {};
    this._createdAt = props.created_at;
    this._updatedAt = props.updated_at;

    this.validate();
  }

  private validate(): void {
    if (!this._id) {
      throw new ValidationError('Product ID is required');
    }

    if (!this._nameEn || this._nameEn.length < 1 || this._nameEn.length > 200) {
      throw new ValidationError('Product name (English) must be between 1 and 200 characters');
    }

    if (this._stockQuantity < 0) {
      throw new ValidationError('Stock quantity cannot be negative');
    }

    if (this._lowStockThreshold < 0) {
      throw new ValidationError('Low stock threshold cannot be negative');
    }

    if (!Object.values(PRODUCT_STATUS).includes(this._status)) {
      throw new ValidationError('Invalid product status');
    }

    if (this._weight && this._weight <= 0) {
      throw new ValidationError('Weight must be positive');
    }
  }

  // Getters
  get id(): ID {
    return this._id;
  }

  get sku(): SKU {
    return this._sku;
  }

  get nameEn(): string {
    return this._nameEn;
  }

  get nameJa(): string | undefined {
    return this._nameJa;
  }

  get descriptionEn(): string | undefined {
    return this._descriptionEn;
  }

  get descriptionJa(): string | undefined {
    return this._descriptionJa;
  }

  get price(): Price {
    return this._price;
  }

  get costPrice(): Price | undefined {
    return this._costPrice;
  }

  get stockQuantity(): number {
    return this._stockQuantity;
  }

  get lowStockThreshold(): number {
    return this._lowStockThreshold;
  }

  get categoryId(): ID | undefined {
    return this._categoryId;
  }

  get imageUrls(): string[] {
    return [...this._imageUrls];
  }

  get isFeatured(): boolean {
    return this._isFeatured;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get weight(): number | undefined {
    return this._weight;
  }

  get dimensions(): { length: number; width: number; height: number } | undefined {
    return this._dimensions ? { ...this._dimensions } : undefined;
  }

  get brand(): string | undefined {
    return this._brand;
  }


  get tags(): string[] {
    return [...this._tags];
  }

  get metadata(): Record<string, any> {
    return { ...this._metadata };
  }

  get created_at(): Timestamp {
    return this._createdAt;
  }

  get updated_at(): Timestamp {
    return this._updatedAt;
  }

  // Business methods
  updateBasicInfo(nameEn: string, nameJa?: string, descriptionEn?: string, descriptionJa?: string): void {
    if (!nameEn || nameEn.length < 1 || nameEn.length > 200) {
      throw new ValidationError('Product name (English) must be between 1 and 200 characters');
    }

    this._nameEn = nameEn;
    this._nameJa = nameJa;
    this._descriptionEn = descriptionEn;
    this._descriptionJa = descriptionJa;
    this._updatedAt = new Date().toISOString();
  }

  updatePrice(price: Price, costPrice?: Price): void {
    this._price = price;
    this._costPrice = costPrice;
    this._updatedAt = new Date().toISOString();
  }

  updateStock(quantity: number): void {
    if (quantity < 0) {
      throw new ValidationError('Stock quantity cannot be negative');
    }
    this._stockQuantity = quantity;
    this._updatedAt = new Date().toISOString();
  }

  reduceStock(quantity: number): void {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    if (this._stockQuantity < quantity) {
      throw new ValidationError('Insufficient stock');
    }
    this._stockQuantity -= quantity;
    this._updatedAt = new Date().toISOString();
  }

  increaseStock(quantity: number): void {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    this._stockQuantity += quantity;
    this._updatedAt = new Date().toISOString();
  }

  setFeatured(featured: boolean): void {
    this._isFeatured = featured;
    this._updatedAt = new Date().toISOString();
  }

  activate(): void {
    this._isActive = true;
    this._status = PRODUCT_STATUS.ACTIVE;
    this._updatedAt = new Date().toISOString();
  }

  deactivate(): void {
    this._isActive = false;
    this._status = PRODUCT_STATUS.INACTIVE;
    this._updatedAt = new Date().toISOString();
  }

  isInStock(): boolean {
    return this._stockQuantity > 0;
  }

  isLowStock(): boolean {
    return this._stockQuantity <= this._lowStockThreshold;
  }

  canFulfillQuantity(quantity: number): boolean {
    return this._stockQuantity >= quantity;
  }

  getMargin(): Price | undefined {
    if (!this._costPrice) return undefined;
    return this._price.subtract(this._costPrice);
  }

  getMarginPercentage(): number | undefined {
    const margin = this.getMargin();
    if (!margin || !this._costPrice) return undefined;
    return (margin.value / this._costPrice.value) * 100;
  }

  equals(other: Product): boolean {
    return this._id === other._id;
  }

  // Factory methods
  static create(props: Omit<ProductProps, 'id' | 'created_at' | 'updated_at'>): Product {
    const now = new Date().toISOString();
    return new Product({
      ...props,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });
  }

  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  // Serialization
  toPlainObject(): ProductProps {
    return {
      id: this._id,
      sku: this._sku.value,
      name_en: this._nameEn,
      name_ja: this._nameJa,
      description_en: this._descriptionEn,
      description_ja: this._descriptionJa,
      price: this._price.value,
      cost_price: this._costPrice?.value,
      stock_quantity: this._stockQuantity,
      low_stock_threshold: this._lowStockThreshold,
      category_id: this._categoryId,
      image_urls: this._imageUrls,
      is_featured: this._isFeatured,
      is_active: this._isActive,
      status: this._status,
      weight: this._weight,
      brand: this._brand,
      dimensions: this._dimensions,
      tags: this._tags,
      metadata: this._metadata,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }

  // Database serialization (maps to actual database schema)
  toDatabaseObject(): any {
    // Extract BoxHero data from metadata if it exists
    const boxheroData = this._metadata?.boxhero_id ? {
      boxhero_item_id: this._metadata.boxhero_id?.toString(),
      boxhero_last_sync_at: this._metadata.boxhero_synced_at || this._updatedAt,
      boxhero_sync_status: 'synced',
      boxhero_locations: this._metadata.boxhero_quantities || null,
    } : {};

    return {
      id: this._id,
      sku: this._sku.value,
      name_en: this._nameEn,
      name_ja: this._nameJa,
      description_en: this._descriptionEn,
      description_ja: this._descriptionJa,
      price: this._price.value,
      cost_price: this._costPrice?.value,
      stock_quantity: this._stockQuantity,
      low_stock_threshold: this._lowStockThreshold,
      category_id: this._categoryId,
      images: this._imageUrls, // Map image_urls to images for database
      is_featured: this._isFeatured,
      is_active: this._isActive,
      // status: this._status, // Removed - column doesn't exist in database
      weight_grams: this._weight,
      brand: this._brand,
      dimensions: this._dimensions,
      tags: this._tags,
      // Map metadata to existing BoxHero columns instead of non-existent metadata column
      ...boxheroData,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
