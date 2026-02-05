import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { DashboardAnalytics, TopBundle, PeriodComparison } from "~/types/bundle";

// GET /api/analytics/dashboard - Dashboard summary
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d"; // 7d, 30d, 90d

  // Calculate date ranges
  const now = new Date();
  let periodDays: number;

  switch (period) {
    case "7d":
      periodDays = 7;
      break;
    case "90d":
      periodDays = 90;
      break;
    default: // 30d
      periodDays = 30;
  }

  const currentPeriodStart = new Date(
    now.getTime() - periodDays * 24 * 60 * 60 * 1000
  );
  const previousPeriodStart = new Date(
    currentPeriodStart.getTime() - periodDays * 24 * 60 * 60 * 1000
  );

  try {
    // Get bundle counts
    const [totalBundles, activeBundles] = await Promise.all([
      prisma.bundle.count({ where: { shop } }),
      prisma.bundle.count({ where: { shop, status: "active" } }),
    ]);

    // Get current period analytics
    const currentPeriodAnalytics = await prisma.bundleAnalytics.aggregate({
      where: {
        bundle: { shop },
        date: {
          gte: currentPeriodStart,
          lte: now,
        },
      },
      _sum: {
        views: true,
        purchaseCount: true,
        revenue: true,
      },
    });

    // Get previous period analytics for comparison
    const previousPeriodAnalytics = await prisma.bundleAnalytics.aggregate({
      where: {
        bundle: { shop },
        date: {
          gte: previousPeriodStart,
          lt: currentPeriodStart,
        },
      },
      _sum: {
        views: true,
        purchaseCount: true,
        revenue: true,
      },
    });

    // Calculate totals
    const totalRevenue = currentPeriodAnalytics._sum.revenue || 0;
    const totalOrders = currentPeriodAnalytics._sum.purchaseCount || 0;
    const totalViews = currentPeriodAnalytics._sum.views || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get top performing bundles
    const topBundlesData = await prisma.bundleAnalytics.groupBy({
      by: ["bundleId"],
      where: {
        bundle: { shop },
        date: {
          gte: currentPeriodStart,
          lte: now,
        },
      },
      _sum: {
        revenue: true,
        purchaseCount: true,
        views: true,
      },
      orderBy: {
        _sum: {
          revenue: "desc",
        },
      },
      take: 5,
    });

    // Fetch bundle details for top bundles
    const topBundleIds = topBundlesData.map((b) => b.bundleId);
    const bundleDetails = await prisma.bundle.findMany({
      where: { id: { in: topBundleIds } },
      select: { id: true, title: true, type: true },
    });

    const bundleDetailsMap = new Map(bundleDetails.map((b) => [b.id, b]));

    const topBundles: TopBundle[] = topBundlesData.map((data) => {
      const bundle = bundleDetailsMap.get(data.bundleId);
      const views = data._sum.views || 0;
      const orders = data._sum.purchaseCount || 0;

      return {
        id: data.bundleId,
        title: bundle?.title || "Unknown Bundle",
        type: (bundle?.type as any) || "FIXED",
        revenue: data._sum.revenue || 0,
        orders,
        conversionRate: views > 0 ? (orders / views) * 100 : 0,
      };
    });

    // Get recent purchases for activity feed
    const recentPurchases = await prisma.bundlePurchase.findMany({
      where: { shop },
      orderBy: { purchasedAt: "desc" },
      take: 10,
      include: {
        // Note: We can't include bundle here since there's no direct relation
        // We'll need to fetch bundle titles separately
      },
    });

    // Fetch bundle titles for recent activity
    const purchaseBundleIds = [...new Set(recentPurchases.map((p) => p.bundleId))];
    const purchaseBundles = await prisma.bundle.findMany({
      where: { id: { in: purchaseBundleIds } },
      select: { id: true, title: true },
    });
    const purchaseBundleMap = new Map(purchaseBundles.map((b) => [b.id, b.title]));

    const recentActivity = recentPurchases.map((purchase) => ({
      id: purchase.id,
      type: "purchase" as const,
      bundleId: purchase.bundleId,
      bundleTitle: purchaseBundleMap.get(purchase.bundleId) || "Unknown Bundle",
      timestamp: purchase.purchasedAt.toISOString(),
      details: `${purchase.quantity}x @ €${purchase.totalPrice.toFixed(2)}`,
    }));

    // Calculate period comparison
    const prevRevenue = previousPeriodAnalytics._sum.revenue || 0;
    const prevOrders = previousPeriodAnalytics._sum.purchaseCount || 0;
    const prevViews = previousPeriodAnalytics._sum.views || 0;

    const periodComparison: PeriodComparison = {
      currentPeriod: {
        revenue: totalRevenue,
        orders: totalOrders,
        views: totalViews,
      },
      previousPeriod: {
        revenue: prevRevenue,
        orders: prevOrders,
        views: prevViews,
      },
      revenueChange:
        prevRevenue > 0
          ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
          : totalRevenue > 0
          ? 100
          : 0,
      ordersChange:
        prevOrders > 0
          ? ((totalOrders - prevOrders) / prevOrders) * 100
          : totalOrders > 0
          ? 100
          : 0,
    };

    const dashboard: DashboardAnalytics = {
      totalBundles,
      activeBundles,
      totalRevenue,
      totalOrders,
      averageOrderValue,
      topBundles,
      recentActivity,
      periodComparison,
    };

    return Response.json(dashboard);
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    return Response.json(
      { error: "Failed to fetch dashboard", details: String(error) },
      { status: 500 }
    );
  }
};
