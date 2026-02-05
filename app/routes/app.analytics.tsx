import { useState, useCallback } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  ButtonGroup,
  Box,
  InlineGrid,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";

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
    default:
      periodDays = 30;
  }

  const currentPeriodStart = new Date(
    now.getTime() - periodDays * 24 * 60 * 60 * 1000
  );
  const previousPeriodStart = new Date(
    currentPeriodStart.getTime() - periodDays * 24 * 60 * 60 * 1000
  );

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
      addToCartCount: true,
    },
  });

  // Get previous period analytics
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

  // Get top bundles
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

  const topBundleIds = topBundlesData.map((b) => b.bundleId);
  const bundleDetails = await prisma.bundle.findMany({
    where: { id: { in: topBundleIds } },
    select: { id: true, title: true, type: true },
  });
  const bundleDetailsMap = new Map(bundleDetails.map((b) => [b.id, b]));

  const topBundles = topBundlesData.map((data) => {
    const bundle = bundleDetailsMap.get(data.bundleId);
    const views = data._sum.views || 0;
    const orders = data._sum.purchaseCount || 0;

    return {
      id: data.bundleId,
      title: bundle?.title || "Unknown Bundle",
      type: bundle?.type || "FIXED",
      revenue: data._sum.revenue || 0,
      orders,
      conversionRate: views > 0 ? (orders / views) * 100 : 0,
    };
  });

  // Get recent purchases
  const recentPurchases = await prisma.bundlePurchase.findMany({
    where: { shop },
    orderBy: { purchasedAt: "desc" },
    take: 10,
  });

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

  // Calculate metrics
  const totalRevenue = currentPeriodAnalytics._sum.revenue || 0;
  const totalOrders = currentPeriodAnalytics._sum.purchaseCount || 0;
  const totalViews = currentPeriodAnalytics._sum.views || 0;
  const totalAddToCarts = currentPeriodAnalytics._sum.addToCartCount || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const prevRevenue = previousPeriodAnalytics._sum.revenue || 0;
  const prevOrders = previousPeriodAnalytics._sum.purchaseCount || 0;

  const revenueChange =
    prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0
      ? 100
      : 0;
  const ordersChange =
    prevOrders > 0
      ? ((totalOrders - prevOrders) / prevOrders) * 100
      : totalOrders > 0
      ? 100
      : 0;

  return {
    totalBundles,
    activeBundles,
    totalRevenue,
    totalOrders,
    totalViews,
    totalAddToCarts,
    averageOrderValue,
    revenueChange,
    ordersChange,
    topBundles,
    recentActivity,
    period,
  };
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState(data.period);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const handlePeriodChange = useCallback(
    (period: string) => {
      setSelectedPeriod(period);
      const params = new URLSearchParams(searchParams);
      params.set("period", period);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  return (
    <Page
      title="Analytics"
      primaryAction={
        <ButtonGroup variant="segmented">
          <Button
            pressed={selectedPeriod === "7d"}
            onClick={() => handlePeriodChange("7d")}
          >
            7 days
          </Button>
          <Button
            pressed={selectedPeriod === "30d"}
            onClick={() => handlePeriodChange("30d")}
          >
            30 days
          </Button>
          <Button
            pressed={selectedPeriod === "90d"}
            onClick={() => handlePeriodChange("90d")}
          >
            90 days
          </Button>
        </ButtonGroup>
      }
    >
      <BlockStack gap="500">
        {/* Key Metrics */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Revenue</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {formatPrice(data.totalRevenue)}
              </Text>
              <Text
                as="p"
                variant="bodySm"
                tone={data.revenueChange >= 0 ? "success" : "critical"}
              >
                {formatChange(data.revenueChange)} vs previous period
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Orders</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.totalOrders}
              </Text>
              <Text
                as="p"
                variant="bodySm"
                tone={data.ordersChange >= 0 ? "success" : "critical"}
              >
                {formatChange(data.ordersChange)} vs previous period
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Average Order Value</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {formatPrice(data.averageOrderValue)}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Per bundle purchase
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Conversion Rate</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.totalViews > 0
                  ? ((data.totalOrders / data.totalViews) * 100).toFixed(1)
                  : 0}
                %
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Views to purchases
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Bundle Stats */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Bundles</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.totalBundles}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Active Bundles</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.activeBundles}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Bundle Views</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.totalViews.toLocaleString()}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Add to Carts</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {data.totalAddToCarts.toLocaleString()}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Top Bundles and Recent Activity */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* Top Bundles */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Top Performing Bundles
              </Text>

              {data.topBundles.length === 0 ? (
                <Text as="p" tone="subdued">
                  No bundle data for this period yet.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {data.topBundles.map((bundle, index) => (
                    <Box
                      key={bundle.id}
                      padding="300"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                    >
                      <InlineStack gap="400" align="space-between" blockAlign="center">
                        <Text as="span" fontWeight="bold" tone="subdued">
                          #{index + 1}
                        </Text>
                        <BlockStack gap="100">
                          <Text as="span" fontWeight="semibold">{bundle.title}</Text>
                          <Badge tone="info">{bundle.type}</Badge>
                        </BlockStack>
                        <BlockStack gap="100" align="end">
                          <Text as="span" fontWeight="semibold">
                            {formatPrice(bundle.revenue)}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {bundle.orders} orders
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          {/* Recent Activity */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Recent Activity
              </Text>

              {data.recentActivity.length === 0 ? (
                <Text as="p" tone="subdued">No recent activity.</Text>
              ) : (
                <BlockStack gap="300">
                  {data.recentActivity.map((activity) => (
                    <Box
                      key={activity.id}
                      padding="300"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                    >
                      <InlineStack gap="300" align="space-between" blockAlign="center">
                        <Badge tone="success">Purchase</Badge>
                        <BlockStack gap="100">
                          <Text as="span" fontWeight="semibold">
                            {activity.bundleTitle}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {activity.details}
                          </Text>
                        </BlockStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </Text>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Export Section */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h3" fontWeight="bold">Export Data</Text>
              <Text as="p" tone="subdued">
                Download analytics data for further analysis
              </Text>
            </BlockStack>
            <InlineStack gap="300">
              <Button
                onClick={() =>
                  window.open(
                    `/api/analytics/export?format=csv&period=${selectedPeriod}`,
                    "_blank"
                  )
                }
              >
                Export CSV
              </Button>
              <Button
                onClick={() =>
                  window.open(
                    `/api/analytics/export?format=json&period=${selectedPeriod}`,
                    "_blank"
                  )
                }
              >
                Export JSON
              </Button>
            </InlineStack>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
