import { groq, GROQ_MODEL } from "@/lib/ai/groq";

export type TopProduct = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
};

export type SalesMetrics = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  averageOrderValue: number;
  topProducts: TopProduct[];
};

export type ReportSnapshot = {
  generatedAt: string;
  sales: {
    count: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    averageOrderValue: number;
  };
  purchases: {
    count: number;
    total: number;
    pending: number;
    received: number;
  };
  inventory: {
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  topProducts: TopProduct[];
  lowStockProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    reorderLevel: number;
    reorderQuantity: number;
  }>;
};

export type AIRecommendation = {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
};

export type AIReport = {
  summary: string;
  salesAnalysis: string;
  inventoryAnalysis: string;
  purchasingAnalysis: string;
  risks: string[];
  opportunities: string[];
  recommendations: AIRecommendation[];
};

type SaleRow = {
  id: string;
  total_amount: number | string | null;
};

type SaleItemRow = {
  sale_id: string;
  product_id: string;
  quantity: number | string | null;
  unit_price: number | string | null;
  discount_amount: number | string | null;
  product:
    | {
        name: string | null;
        sku: string | null;
        cost_price: number | string | null;
      }
    | null;
};

function round(value: number, decimals = 2): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function calculateSalesMetrics(
  sales: SaleRow[],
  saleItems: SaleItemRow[]
): SalesMetrics {
  const revenue = round(
    sales.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0)
  );

  let cogs = 0;

  const productMap = new Map<string, TopProduct>();

  for (const item of saleItems) {
  const quantity = toNumber(item.quantity);
  const unitPrice = toNumber(item.unit_price);
  const discount = toNumber(item.discount_amount);
  const costPrice = toNumber(item.product?.cost_price);

  const lineRevenue = Math.max(0, quantity * unitPrice - discount);
  const lineCogs = quantity * costPrice;
  const lineProfit = lineRevenue - lineCogs;

  cogs += lineCogs;

  const existing = productMap.get(item.product_id);

  if (existing) {
    existing.quantity += quantity;
    existing.revenue += lineRevenue;
    existing.cogs += lineCogs;
    existing.profit += lineProfit;
  } else {
    productMap.set(item.product_id, {
      productId: item.product_id,
      name: item.product?.name ?? "Unknown product",
      sku: item.product?.sku ?? "-",
      quantity,
      revenue: lineRevenue,
      cogs: lineCogs,
      profit: lineProfit,
      margin: lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0,
    });
  }
}

  const topProducts = Array.from(productMap.values())
  .map((product) => ({
    ...product,
    quantity: round(product.quantity, 3),
    revenue: round(product.revenue),
    cogs: round(product.cogs),
    profit: round(product.profit),
    margin: round(product.margin, 1),
  }))
  .sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return b.quantity - a.quantity;
  })
  .slice(0, 10);

  const grossProfit = round(revenue - cogs);
  const averageOrderValue = sales.length > 0 ? round(revenue / sales.length) : 0;

  return {
    revenue,
    cogs: round(cogs),
    grossProfit,
    averageOrderValue,
    topProducts,
  };
}

function cleanJsonResponse(content: string): string {
  return content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isAIReport(value: unknown): value is AIReport {
  if (!value || typeof value !== "object") return false;

  const report = value as Record<string, unknown>;

  if (
    typeof report.summary !== "string" ||
    typeof report.salesAnalysis !== "string" ||
    typeof report.inventoryAnalysis !== "string" ||
    typeof report.purchasingAnalysis !== "string"
  ) {
    return false;
  }

  if (
    !Array.isArray(report.risks) ||
    !Array.isArray(report.opportunities) ||
    !Array.isArray(report.recommendations)
  ) {
    return false;
  }

  if (!report.risks.every((item) => typeof item === "string")) return false;
  if (!report.opportunities.every((item) => typeof item === "string")) return false;

  return report.recommendations.every((item) => {
    if (!item || typeof item !== "object") return false;
    const recommendation = item as Record<string, unknown>;

    return (
      (recommendation.priority === "high" ||
        recommendation.priority === "medium" ||
        recommendation.priority === "low") &&
      typeof recommendation.action === "string" &&
      typeof recommendation.reason === "string"
    );
  });
}

function buildPrompt(snapshot: ReportSnapshot): string {
  return JSON.stringify(
    {
      task: "Analyze this stock management business data and produce an actionable management report.",
      rules: [
        "Use only the supplied data.",
        "Do not invent facts.",
        "Be concise and specific.",
        "Identify meaningful business risks.",
        "Identify realistic opportunities.",
        "Recommendations must be actionable.",
        "Return only valid JSON.",
      ],
      requiredSchema: {
        summary: "string",
        salesAnalysis: "string",
        inventoryAnalysis: "string",
        purchasingAnalysis: "string",
        risks: ["string"],
        opportunities: ["string"],
        recommendations: [
          {
            priority: "high | medium | low",
            action: "string",
            reason: "string",
          },
        ],
      },
      data: snapshot,
    },
    null,
    2
  );
}

export async function generateAIReport(snapshot: ReportSnapshot): Promise<AIReport> {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a precise business intelligence analyst. Return only valid JSON matching the requested schema.",
        },
        {
          role: "user",
          content: buildPrompt(snapshot),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("The AI returned an empty response.");
    }

    const cleaned = cleanJsonResponse(content);
    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The AI returned invalid JSON.");
    }

    if (!isAIReport(parsed)) {
      throw new Error("The AI returned an invalid report structure.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error("Failed to generate AI report.");
  }
}
