import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// GET /api/analytics/export - Export analytics CSV
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const bundleId = url.searchParams.get("bundleId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const format = url.searchParams.get("format") || "csv"; // csv or json
  const type = url.searchParams.get("type") || "analytics"; // analytics or purchases

  // Calculate date range
  const dateFrom = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = endDate ? new Date(endDate) : new Date();

  try {
    if (type === "purchases") {
      // Export purchase data
      const where: Record<string, unknown> = {
        shop,
        purchasedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      };

      if (bundleId) {
        where.bundleId = bundleId;
      }

      const purchases = await prisma.bundlePurchase.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
      });

      // Fetch bundle titles
      const bundleIds = [...new Set(purchases.map((p) => p.bundleId))];
      const bundles = await prisma.bundle.findMany({
        where: { id: { in: bundleIds } },
        select: { id: true, title: true, type: true },
      });
      const bundleMap = new Map(bundles.map((b) => [b.id, b]));

      if (format === "json") {
        return new Response(
          JSON.stringify(
            purchases.map((p) => ({
              ...p,
              bundleTitle: bundleMap.get(p.bundleId)?.title || "Unknown",
              bundleType: bundleMap.get(p.bundleId)?.type || "Unknown",
            })),
            null,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition": `attachment; filename="bundle-purchases-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.json"`,
            },
          }
        );
      }

      // Generate CSV
      const csvHeaders = [
        "Purchase ID",
        "Bundle ID",
        "Bundle Title",
        "Bundle Type",
        "Order ID",
        "Customer ID",
        "Quantity",
        "Unit Price",
        "Total Price",
        "Discount Amount",
        "Tier",
        "Selected Items",
        "Purchase Date",
      ];

      const csvRows = purchases.map((p) => {
        const bundle = bundleMap.get(p.bundleId);
        return [
          p.id,
          p.bundleId,
          `"${(bundle?.title || "Unknown").replace(/"/g, '""')}"`,
          bundle?.type || "Unknown",
          p.shopifyOrderId,
          p.shopifyCustomerId || "",
          p.quantity,
          p.unitPrice.toFixed(2),
          p.totalPrice.toFixed(2),
          p.discountAmount.toFixed(2),
          p.tierName || "",
          `"${(p.selectedItems || "").replace(/"/g, '""')}"`,
          p.purchasedAt.toISOString(),
        ].join(",");
      });

      const csv = [csvHeaders.join(","), ...csvRows].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="bundle-purchases-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Export analytics data (default)
    const where: Record<string, unknown> = {
      bundle: { shop },
      date: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    if (bundleId) {
      where.bundleId = bundleId;
    }

    const analytics = await prisma.bundleAnalytics.findMany({
      where,
      include: {
        bundle: {
          select: { id: true, title: true, type: true },
        },
      },
      orderBy: [{ bundleId: "asc" }, { date: "asc" }],
    });

    if (format === "json") {
      return new Response(JSON.stringify(analytics, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="bundle-analytics-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // Generate CSV
    const csvHeaders = [
      "Date",
      "Bundle ID",
      "Bundle Title",
      "Bundle Type",
      "Views",
      "Add to Cart",
      "Purchases",
      "Revenue",
      "Unique Visitors",
      "Conversion Rate",
      "Avg Order Value",
      "Avg Discount",
    ];

    const csvRows = analytics.map((a) => {
      return [
        a.date.toISOString().split("T")[0],
        a.bundleId,
        `"${a.bundle.title.replace(/"/g, '""')}"`,
        a.bundle.type,
        a.views,
        a.addToCartCount,
        a.purchaseCount,
        a.revenue.toFixed(2),
        a.uniqueVisitors,
        a.conversionRate.toFixed(2),
        a.averageOrderValue.toFixed(2),
        a.averageDiscount.toFixed(2),
      ].join(",");
    });

    const csv = [csvHeaders.join(","), ...csvRows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="bundle-analytics-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return new Response(
      JSON.stringify({ error: "Failed to export analytics", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
