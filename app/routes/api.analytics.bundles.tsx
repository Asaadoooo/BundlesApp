import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { BundleAnalyticsResponse, BundleMetrics, DailyAnalytics } from "~/types/bundle";

// GET /api/analytics/bundles - Bundle performance data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const bundleId = url.searchParams.get("bundleId");
  const period = url.searchParams.get("period") || "30d"; // 7d, 30d, 90d, all
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  // Calculate date range
  let dateFrom: Date;
  let dateTo = new Date();

  if (startDate && endDate) {
    dateFrom = new Date(startDate);
    dateTo = new Date(endDate);
  } else {
    switch (period) {
      case "7d":
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        dateFrom = new Date(0);
        break;
      default: // 30d
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  try {
    // Build where clause
    const where: Record<string, unknown> = {
      date: {
        gte: dateFrom,
        lte: dateTo,
      },
      bundle: {
        shop,
      },
    };

    if (bundleId) {
      where.bundleId = bundleId;
    }

    // Get analytics data
    const analytics = await prisma.bundleAnalytics.findMany({
      where,
      include: {
        bundle: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // If requesting single bundle analytics
    if (bundleId) {
      const bundle = await prisma.bundle.findFirst({
        where: { id: bundleId, shop },
        select: { id: true, title: true },
      });

      if (!bundle) {
        return Response.json({ error: "Bundle not found" }, { status: 404 });
      }

      // Aggregate metrics
      const metrics: BundleMetrics = analytics.reduce(
        (acc, day) => ({
          totalViews: acc.totalViews + day.views,
          totalAddToCarts: acc.totalAddToCarts + day.addToCartCount,
          totalPurchases: acc.totalPurchases + day.purchaseCount,
          totalRevenue: acc.totalRevenue + day.revenue,
          conversionRate: 0, // Calculated below
          averageOrderValue: 0, // Calculated below
          averageDiscount: 0, // Calculated below
        }),
        {
          totalViews: 0,
          totalAddToCarts: 0,
          totalPurchases: 0,
          totalRevenue: 0,
          conversionRate: 0,
          averageOrderValue: 0,
          averageDiscount: 0,
        }
      );

      // Calculate derived metrics
      if (metrics.totalViews > 0) {
        metrics.conversionRate =
          (metrics.totalPurchases / metrics.totalViews) * 100;
      }
      if (metrics.totalPurchases > 0) {
        metrics.averageOrderValue = metrics.totalRevenue / metrics.totalPurchases;
      }

      // Calculate average discount from analytics
      const discounts = analytics
        .filter((a) => a.averageDiscount > 0)
        .map((a) => a.averageDiscount);
      if (discounts.length > 0) {
        metrics.averageDiscount =
          discounts.reduce((a, b) => a + b, 0) / discounts.length;
      }

      // Transform to daily data
      const dailyData: DailyAnalytics[] = analytics.map((day) => ({
        date: day.date.toISOString().split("T")[0],
        views: day.views,
        addToCartCount: day.addToCartCount,
        purchaseCount: day.purchaseCount,
        revenue: day.revenue,
        conversionRate: day.conversionRate,
      }));

      const response: BundleAnalyticsResponse = {
        bundleId,
        bundleTitle: bundle.title,
        period,
        metrics,
        dailyData,
      };

      return Response.json(response);
    }

    // Aggregate by bundle for multiple bundles
    const bundleAnalyticsMap = new Map<
      string,
      {
        bundle: { id: string; title: string; type: string };
        metrics: BundleMetrics;
        dailyData: DailyAnalytics[];
      }
    >();

    for (const record of analytics) {
      const existing = bundleAnalyticsMap.get(record.bundleId);

      if (!existing) {
        bundleAnalyticsMap.set(record.bundleId, {
          bundle: record.bundle,
          metrics: {
            totalViews: record.views,
            totalAddToCarts: record.addToCartCount,
            totalPurchases: record.purchaseCount,
            totalRevenue: record.revenue,
            conversionRate: 0,
            averageOrderValue: 0,
            averageDiscount: 0,
          },
          dailyData: [
            {
              date: record.date.toISOString().split("T")[0],
              views: record.views,
              addToCartCount: record.addToCartCount,
              purchaseCount: record.purchaseCount,
              revenue: record.revenue,
              conversionRate: record.conversionRate,
            },
          ],
        });
      } else {
        existing.metrics.totalViews += record.views;
        existing.metrics.totalAddToCarts += record.addToCartCount;
        existing.metrics.totalPurchases += record.purchaseCount;
        existing.metrics.totalRevenue += record.revenue;
        existing.dailyData.push({
          date: record.date.toISOString().split("T")[0],
          views: record.views,
          addToCartCount: record.addToCartCount,
          purchaseCount: record.purchaseCount,
          revenue: record.revenue,
          conversionRate: record.conversionRate,
        });
      }
    }

    // Calculate derived metrics for each bundle
    for (const data of bundleAnalyticsMap.values()) {
      if (data.metrics.totalViews > 0) {
        data.metrics.conversionRate =
          (data.metrics.totalPurchases / data.metrics.totalViews) * 100;
      }
      if (data.metrics.totalPurchases > 0) {
        data.metrics.averageOrderValue =
          data.metrics.totalRevenue / data.metrics.totalPurchases;
      }
    }

    const bundleAnalytics = Array.from(bundleAnalyticsMap.values()).map(
      (data) => ({
        bundleId: data.bundle.id,
        bundleTitle: data.bundle.title,
        bundleType: data.bundle.type,
        period,
        metrics: data.metrics,
        dailyData: data.dailyData,
      })
    );

    return Response.json({
      period,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      bundles: bundleAnalytics,
    });
  } catch (error) {
    console.error("Error fetching bundle analytics:", error);
    return Response.json(
      { error: "Failed to fetch analytics", details: String(error) },
      { status: 500 }
    );
  }
};
