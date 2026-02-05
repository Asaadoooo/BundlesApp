import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
  InlineGrid,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { formatPrice, getEffectiveStatus } from "~/utils/bundle";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get bundle stats
  const [totalBundles, activeBundles, draftBundles] = await Promise.all([
    prisma.bundle.count({ where: { shop } }),
    prisma.bundle.count({ where: { shop, status: "active" } }),
    prisma.bundle.count({ where: { shop, status: "draft" } }),
  ]);

  // Get recent bundles
  const recentBundles = await prisma.bundle.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      _count: {
        select: { items: true },
      },
    },
  });

  // Get 30-day analytics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analytics = await prisma.bundleAnalytics.aggregate({
    where: {
      bundle: { shop },
      date: { gte: thirtyDaysAgo },
    },
    _sum: {
      views: true,
      purchaseCount: true,
      revenue: true,
    },
  });

  return {
    stats: {
      totalBundles,
      activeBundles,
      draftBundles,
      totalViews: analytics._sum.views || 0,
      totalPurchases: analytics._sum.purchaseCount || 0,
      totalRevenue: analytics._sum.revenue || 0,
    },
    recentBundles: recentBundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      type: bundle.type,
      status: bundle.status,
      effectiveStatus: getEffectiveStatus(bundle),
      itemCount: bundle._count.items,
      updatedAt: bundle.updatedAt.toISOString(),
    })),
  };
};

export default function DashboardPage() {
  const { stats, recentBundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, string> = {
      FIXED: "Fixed",
      MIX_MATCH: "Mix & Match",
      VOLUME: "Volume",
      TIERED: "Tiered",
    };
    return typeMap[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { tone: "success" | "info" | "warning" | "critical"; label: string }> = {
      active: { tone: "success", label: "Active" },
      draft: { tone: "info", label: "Draft" },
      scheduled: { tone: "warning", label: "Scheduled" },
      archived: { tone: "info", label: "Archived" },
    };
    return statusMap[status] || { tone: "info" as const, label: status };
  };

  return (
    <Page
      title="Dashboard"
      primaryAction={{
        content: "Create bundle",
        onAction: () => navigate("/app/bundles/new"),
      }}
    >
      <BlockStack gap="500">
        {/* Quick Stats */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Bundles</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {stats.totalBundles}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {stats.activeBundles} active, {stats.draftBundles} drafts
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">30-Day Revenue</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {formatPrice(stats.totalRevenue)}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                From bundle sales
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">30-Day Purchases</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {stats.totalPurchases}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Bundle orders
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">30-Day Views</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {stats.totalViews.toLocaleString()}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Bundle page views
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Main Content Row */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* Getting Started or Recent Bundles */}
          {stats.totalBundles === 0 ? (
            <Card>
              <BlockStack gap="400" align="center">
                <Text as="h2" variant="headingLg" fontWeight="bold">
                  Welcome to Bundle App
                </Text>
                <Text as="p" tone="subdued" alignment="center">
                  Create product bundles to increase average order value and
                  offer better deals to your customers.
                </Text>
                <Button variant="primary" onClick={() => navigate("/app/bundles/new")}>
                  Create your first bundle
                </Button>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Recent Bundles
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/bundles")}>
                    View all
                  </Button>
                </InlineStack>

                <BlockStack gap="300">
                  {recentBundles.map((bundle) => {
                    const statusBadge = getStatusBadge(bundle.effectiveStatus);
                    return (
                      <Box
                        key={bundle.id}
                        padding="300"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor="border"
                      >
                        <div
                          onClick={() => navigate(`/app/bundles/${bundle.id}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <InlineStack gap="400" align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text as="span" fontWeight="semibold">{bundle.title}</Text>
                              <InlineStack gap="200">
                                <Badge tone="info">
                                  {getTypeBadge(bundle.type)}
                                </Badge>
                                <Badge tone={statusBadge.tone}>
                                  {statusBadge.label}
                                </Badge>
                              </InlineStack>
                            </BlockStack>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {bundle.itemCount} items
                            </Text>
                          </InlineStack>
                        </div>
                      </Box>
                    );
                  })}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Quick Actions
              </Text>

              <BlockStack gap="300">
                <Box
                  padding="300"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <div
                    onClick={() => navigate("/app/bundles/new/fixed")}
                    style={{ cursor: "pointer" }}
                  >
                    <BlockStack gap="100">
                      <Text as="span" fontWeight="semibold">Create Fixed Bundle</Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Pre-configured product packages
                      </Text>
                    </BlockStack>
                  </div>
                </Box>

                <Box
                  padding="300"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <div
                    onClick={() => navigate("/app/bundles/new/mix_match")}
                    style={{ cursor: "pointer" }}
                  >
                    <BlockStack gap="100">
                      <Text as="span" fontWeight="semibold">Create Mix & Match</Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Let customers build their own
                      </Text>
                    </BlockStack>
                  </div>
                </Box>

                <Box
                  padding="300"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <div
                    onClick={() => navigate("/app/bundles/new/volume")}
                    style={{ cursor: "pointer" }}
                  >
                    <BlockStack gap="100">
                      <Text as="span" fontWeight="semibold">Create Volume Discount</Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Buy more, save more
                      </Text>
                    </BlockStack>
                  </div>
                </Box>

                <Box
                  padding="300"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <div
                    onClick={() => navigate("/app/bundles/new/tiered")}
                    style={{ cursor: "pointer" }}
                  >
                    <BlockStack gap="100">
                      <Text as="span" fontWeight="semibold">Create Tiered Bundle</Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Bronze / Silver / Gold options
                      </Text>
                    </BlockStack>
                  </div>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Help Section */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h3" fontWeight="bold">Need help?</Text>
              <Text as="p" tone="subdued">
                Learn how to create effective bundles that drive sales.
              </Text>
            </BlockStack>
            <Button onClick={() => navigate("/app/analytics")}>
              View Analytics
            </Button>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
