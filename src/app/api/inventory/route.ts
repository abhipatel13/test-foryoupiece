import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/application/services/InventoryService';
import { SupabaseProductRepository } from '@/infrastructure/repositories/SupabaseProductRepository';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

// API token for BoxHero - loaded from environment variables
const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

/**
 * Record a sale and update inventory
 * POST /api/inventory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, productId, quantity, orderId, locationId, reason } = body;

    if (!productId || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'Product ID and quantity are required',
      }, { status: 400 });
    }

    if (!BOXHERO_API_TOKEN) {
      console.error('❌ BOXHERO_API_TOKEN environment variable is not set');
      return NextResponse.json({
        success: false,
        error: 'BoxHero API token not configured'
      }, { status: 500 });
    }

    // Initialize services
    const productRepository = new SupabaseProductRepository();
    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const inventoryService = new InventoryService(productRepository, boxHeroService);

    switch (action) {
      case 'sale': {
        const result = await inventoryService.recordSale(
          productId,
          quantity,
          orderId,
          locationId
        );

        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            message: `Sale recorded: ${quantity} units`,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'return': {
        const result = await inventoryService.recordReturn(
          productId,
          quantity,
          orderId,
          locationId
        );

        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            message: `Return recorded: ${quantity} units`,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'adjust': {
        if (!reason) {
          return NextResponse.json({
            success: false,
            error: 'Reason is required for stock adjustments',
          }, { status: 400 });
        }

        const result = await inventoryService.adjustStock(
          productId,
          quantity, // This is the new quantity, not the adjustment amount
          reason,
          locationId
        );

        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            message: `Stock adjusted to ${quantity} units`,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'check': {
        const result = await inventoryService.checkStock(productId, quantity);

        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: sale, return, adjust, or check',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Get low stock products
 * GET /api/inventory
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Initialize services
    const productRepository = new SupabaseProductRepository();
    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const inventoryService = new InventoryService(productRepository, boxHeroService);

    switch (action) {
      case 'low-stock': {
        const result = await inventoryService.getLowStockProducts();

        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            count: result.data.length,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: low-stock',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Bulk inventory operations
 * PUT /api/inventory
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { operations } = body;

    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json({
        success: false,
        error: 'Operations array is required',
      }, { status: 400 });
    }

    // Initialize services
    const productRepository = new SupabaseProductRepository();
    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const inventoryService = new InventoryService(productRepository, boxHeroService);

    const results = [];
    const errors = [];

    for (const operation of operations) {
      try {
        const { action, productId, quantity, orderId, locationId, reason } = operation;

        let result;
        switch (action) {
          case 'sale':
            result = await inventoryService.recordSale(productId, quantity, orderId, locationId);
            break;
          case 'return':
            result = await inventoryService.recordReturn(productId, quantity, orderId, locationId);
            break;
          case 'adjust':
            result = await inventoryService.adjustStock(productId, quantity, reason, locationId);
            break;
          default:
            throw new Error(`Invalid action: ${action}`);
        }

        if (result.success) {
          results.push({
            productId,
            action,
            success: true,
            data: result.data,
          });
        } else {
          errors.push({
            productId,
            action,
            error: result.error.message,
          });
        }
      } catch (error) {
        errors.push({
          productId: operation.productId,
          action: operation.action,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Bulk inventory API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
