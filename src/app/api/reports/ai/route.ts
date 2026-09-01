import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateSalesMetrics,
  generateAIReport,
  type ReportSnapshot,
} from "@/lib/ai/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const [
      salesResult,
      saleItemsResult,
      purchasesResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id,total_amount")
        .eq("status", "completed"),

      supabase
        .from("sale_items")
        .select(
          `
          sale_id,
          product_id,
          quantity,
          unit_price,
          discount_amount,
          product:products(
            name,
            sku,
            cost_price
          )
        `
        ),

      supabase
        .from("purchase_orders")
        .select("id,status,total_amount"),

      supabase
        .from("inventory")
        .select(
          `
          product_id,
          quantity,
          warehouse_id,
          product:products(
            name,
            sku,
            reorder_level,
            reorder_quantity,
            cost_price
          )
        `
        ),
    ]);

    const firstError =
      salesResult.error ??
      saleItemsResult.error ??
      purchasesResult.error ??
      inventoryResult.error;

    if (firstError) {
      return NextResponse.json(
        {
          error: firstError.message,
        },
        { status: 500 }
      );
    }

    const sales = salesResult.data ?? [];
    const saleItems = saleItemsResult.data ?? [];
    const purchases = purchasesResult.data ?? [];
    const inventory = inventoryResult.data ?? [];

    const salesMetrics = calculateSalesMetrics(
      sales,
      saleItems.map((item) => ({
        ...item,
        product: Array.isArray(item.product)
          ? item.product[0] ?? null
          : item.product,
      }))
    );

    const inventoryByProduct = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string;
        quantity: number;
        reorderLevel: number;
        reorderQuantity: number;
        inventoryValue: number;
      }
    >();

    for (const row of inventory) {
      const product = Array.isArray(row.product)
        ? row.product[0] ?? null
        : row.product;

      const quantity = Number(row.quantity) || 0;
      const costPrice = Number(product?.cost_price) || 0;
      const reorderLevel = Number(product?.reorder_level) || 0;
      const reorderQuantity = Number(product?.reorder_quantity) || 0;

      const existing = inventoryByProduct.get(row.product_id);

      if (existing) {
        existing.quantity += quantity;
        existing.inventoryValue += quantity * costPrice;
      } else {
        inventoryByProduct.set(row.product_id, {
          productId: row.product_id,
          name: product?.name ?? "Unknown product",
          sku: product?.sku ?? "—",
          quantity,
          reorderLevel,
          reorderQuantity,
          inventoryValue: quantity * costPrice,
        });
      }
    }

    const inventoryProducts = Array.from(inventoryByProduct.values());

    const lowStockProducts = inventoryProducts
      .filter(
        (product) =>
          product.quantity > 0 &&
          product.quantity <= product.reorderLevel
      )
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 20);

    const outOfStockProducts = inventoryProducts
      .filter((product) => product.quantity <= 0)
      .slice(0, 20);

    const inventoryValue = inventoryProducts.reduce(
      (sum, product) => sum + product.inventoryValue,
      0
    );

    const totalUnits = inventoryProducts.reduce(
      (sum, product) => sum + product.quantity,
      0
    );

    const pendingPurchases = purchases.filter(
      (purchase) => purchase.status === "pending"
    ).length;

    const receivedPurchases = purchases.filter(
      (purchase) => purchase.status === "received"
    ).length;

    const purchaseTotal = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.total_amount ?? 0),
      0
    );

    const snapshot: ReportSnapshot = {
      generatedAt: new Date().toISOString(),

      sales: {
        count: sales.length,
        revenue: salesMetrics.revenue,
        cogs: salesMetrics.cogs,
        grossProfit: salesMetrics.grossProfit,
        averageOrderValue: salesMetrics.averageOrderValue,
      },

      purchases: {
        count: purchases.length,
        total: Math.round(purchaseTotal * 100) / 100,
        pending: pendingPurchases,
        received: receivedPurchases,
      },

      inventory: {
        totalProducts: inventoryProducts.length,
        totalUnits: Math.round(totalUnits * 1000) / 1000,
        inventoryValue: Math.round(inventoryValue * 100) / 100,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
      },

      topProducts: salesMetrics.topProducts,

      lowStockProducts: lowStockProducts.map((product) => ({
        productId: product.productId,
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        reorderLevel: product.reorderLevel,
        reorderQuantity: product.reorderQuantity,
      })),
    };

    const ai = await generateAIReport(snapshot);

    return NextResponse.json({
      snapshot,
      ai,
    });
  } catch (error) {
    console.error("AI report error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate AI report.",
      },
      { status: 500 }
    );
  }
}