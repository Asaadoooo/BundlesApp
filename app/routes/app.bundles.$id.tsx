import { useCallback, useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
  Thumbnail,
  Divider,
  Popover,
  ActionList,
  InlineGrid,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { formatPrice, getEffectiveStatus } from "~/utils/bundle";
import { BundleStatus, BundleType } from "~/types/bundle";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (!id) {
    throw new Response("Bundle ID required", { status: 400 });
  }

  const bundle = await prisma.bundle.findFirst({
    where: { id, shop },
    include: {
      items: {
        orderBy: { position: "asc" },
      },
      tiers: {
        orderBy: { position: "asc" },
      },
      volumeRules: {
        orderBy: { position: "asc" },
      },
      categories: {
        include: {
          items: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!bundle) {
    throw new Response("Bundle not found", { status: 404 });
  }

  // Get recent analytics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analytics = await prisma.bundleAnalytics.aggregate({
    where: {
      bundleId: id,
      date: { gte: thirtyDaysAgo },
    },
    _sum: {
      views: true,
      addToCartCount: true,
      purchaseCount: true,
      revenue: true,
    },
  });

  return {
    bundle: {
      ...bundle,
      effectiveStatus: getEffectiveStatus(bundle),
    },
    analytics: {
      views: analytics._sum.views || 0,
      addToCarts: analytics._sum.addToCartCount || 0,
      purchases: analytics._sum.purchaseCount || 0,
      revenue: analytics._sum.revenue || 0,
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (!id) {
    return Response.json({ error: "Bundle ID required" }, { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "delete") {
    await prisma.bundle.delete({ where: { id } });
    return redirect("/app/bundles");
  }

  if (action === "activate") {
    await prisma.bundle.update({
      where: { id },
      data: { status: BundleStatus.ACTIVE },
    });
    return Response.json({ success: true, message: "Bundle activated" });
  }

  if (action === "deactivate") {
    await prisma.bundle.update({
      where: { id },
      data: { status: BundleStatus.DRAFT },
    });
    return Response.json({ success: true, message: "Bundle deactivated" });
  }

  if (action === "archive") {
    await prisma.bundle.update({
      where: { id },
      data: { status: BundleStatus.ARCHIVED },
    });
    return Response.json({ success: true, message: "Bundle archived" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

export default function BundleDetailPage() {
  const { bundle, analytics } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [popoverActive, setPopoverActive] = useState(false);

  const priceFormatter = (price: number) => formatPrice(price);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const handleAction = useCallback(
    (action: string) => {
      if (action === "delete") {
        if (!confirm("Are you sure you want to delete this bundle?")) {
          return;
        }
      }
      fetcher.submit({ action }, { method: "POST" });
    },
    [fetcher]
  );

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { tone: "success" | "info" | "warning" | "critical"; label: string }> = {
      active: { tone: "success", label: "Active" },
      draft: { tone: "info", label: "Draft" },
      scheduled: { tone: "warning", label: "Scheduled" },
      archived: { tone: "info", label: "Archived" },
      expired: { tone: "critical", label: "Expired" },
    };
    return statusMap[status] || { tone: "info" as const, label: status };
  };

  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, string> = {
      FIXED: "Fixed Bundle",
      MIX_MATCH: "Mix & Match",
      VOLUME: "Volume Discount",
      TIERED: "Tiered Bundle",
    };
    return typeMap[type] || type;
  };

  const statusBadge = getStatusBadge(bundle.effectiveStatus);
  const isActive = bundle.effectiveStatus === "active";

  return (
    <Page
      title={bundle.title}
      backAction={{
        content: "Bundles",
        onAction: () => navigate("/app/bundles"),
      }}
      primaryAction={{
        content: isActive ? "Deactivate" : "Activate",
        onAction: () => handleAction(isActive ? "deactivate" : "activate"),
      }}
      secondaryActions={[
        {
          content: "Edit",
          onAction: () =>
            navigate(
              `/app/bundles/new/${bundle.type.toLowerCase()}?edit=${bundle.id}`
            ),
        },
        {
          content: "Archive",
          onAction: () => handleAction("archive"),
        },
        {
          content: "Delete",
          destructive: true,
          onAction: () => handleAction("delete"),
        },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
        {/* Main Content */}
        <BlockStack gap="400">
          {/* Status & Type */}
          <Card>
            <InlineStack gap="300" align="start" blockAlign="center">
              <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
              <Badge tone="info">{getTypeBadge(bundle.type)}</Badge>
              {bundle.startDate && (
                <Text as="span" variant="bodySm" tone="subdued">
                  Starts: {new Date(bundle.startDate).toLocaleDateString()}
                </Text>
              )}
              {bundle.endDate && (
                <Text as="span" variant="bodySm" tone="subdued">
                  Ends: {new Date(bundle.endDate).toLocaleDateString()}
                </Text>
              )}
            </InlineStack>
          </Card>

          {/* Description */}
          {bundle.description && (
            <Card>
              <BlockStack gap="200">
                <Text as="h3" fontWeight="bold">
                  Description
                </Text>
                <Text as="p">{bundle.description}</Text>
              </BlockStack>
            </Card>
          )}

          {/* Products */}
          {bundle.items.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Products ({bundle.items.length})
                </Text>
                <BlockStack gap="200">
                  {bundle.items.map((item) => (
                    <Box
                      key={item.id}
                      padding="300"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                    >
                      <InlineStack gap="300" align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          {item.productImage && (
                            <Thumbnail
                              source={item.productImage}
                              alt={item.productTitle}
                              size="small"
                            />
                          )}
                          <BlockStack gap="100">
                            <Text as="span" fontWeight="semibold">
                              {item.productTitle}
                            </Text>
                            {item.variantTitle && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                {item.variantTitle}
                              </Text>
                            )}
                          </BlockStack>
                        </InlineStack>
                        <InlineStack gap="300" blockAlign="center">
                          <Text as="span">x{item.quantity}</Text>
                          {item.originalPrice && (
                            <Text as="span" fontWeight="semibold">
                              {priceFormatter(item.originalPrice)}
                            </Text>
                          )}
                        </InlineStack>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Categories (Mix & Match) */}
          {bundle.categories.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Categories ({bundle.categories.length})
                </Text>
                <BlockStack gap="300">
                  {bundle.categories.map((category) => (
                    <Box
                      key={category.id}
                      padding="300"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="span" fontWeight="semibold">
                            {category.name}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {category.items.length} products
                            {category.minSelect > 0 && ` | Min: ${category.minSelect}`}
                            {category.maxSelect && ` | Max: ${category.maxSelect}`}
                          </Text>
                        </InlineStack>
                        {category.description && (
                          <Text as="p" variant="bodySm">
                            {category.description}
                          </Text>
                        )}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Tiers (Tiered Bundles) */}
          {bundle.tiers.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Tiers ({bundle.tiers.length})
                </Text>
                <InlineStack gap="300" wrap>
                  {bundle.tiers.map((tier) => (
                    <Box
                      key={tier.id}
                      padding="400"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      background={tier.featured ? "bg-surface-success" : undefined}
                      minWidth="200px"
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" fontWeight="bold">
                            {tier.name}
                          </Text>
                          {tier.badgeText && (
                            <Badge tone="success">{tier.badgeText}</Badge>
                          )}
                        </InlineStack>
                        <Text as="p" variant="headingMd" fontWeight="bold">
                          {priceFormatter(tier.price)}
                        </Text>
                        {tier.compareAtPrice && (
                          <Text
                            as="p"
                            variant="bodySm"
                            tone="subdued"
                            textDecorationLine="line-through"
                          >
                            {priceFormatter(tier.compareAtPrice)}
                          </Text>
                        )}
                        <Text as="p" variant="bodySm">
                          {tier.productCount} products
                        </Text>
                      </BlockStack>
                    </Box>
                  ))}
                </InlineStack>
              </BlockStack>
            </Card>
          )}

          {/* Volume Rules */}
          {bundle.volumeRules.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Volume Discount Rules
                </Text>
                <BlockStack gap="200">
                  {bundle.volumeRules.map((rule) => (
                    <Box
                      key={rule.id}
                      padding="300"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="span">
                          {rule.maxQuantity
                            ? `${rule.minQuantity} - ${rule.maxQuantity} items`
                            : `${rule.minQuantity}+ items`}
                        </Text>
                        <Text as="span" fontWeight="semibold" tone="success">
                          {rule.discountType === "percentage"
                            ? `${rule.discountValue}% off`
                            : `${priceFormatter(rule.discountValue)} off`}
                        </Text>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}
        </BlockStack>

        {/* Sidebar */}
        <BlockStack gap="400">
          {/* Pricing */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Pricing
              </Text>
              {bundle.price && (
                <InlineStack align="space-between">
                  <Text as="span">Bundle price:</Text>
                  <Text as="span" fontWeight="bold">
                    {priceFormatter(bundle.price)}
                  </Text>
                </InlineStack>
              )}
              {bundle.compareAtPrice && (
                <InlineStack align="space-between">
                  <Text as="span">Compare at:</Text>
                  <Text as="span" tone="subdued" textDecorationLine="line-through">
                    {priceFormatter(bundle.compareAtPrice)}
                  </Text>
                </InlineStack>
              )}
              {bundle.discountType && bundle.discountValue && (
                <InlineStack align="space-between">
                  <Text as="span">Discount:</Text>
                  <Text as="span" tone="success">
                    {bundle.discountType === "percentage"
                      ? `${bundle.discountValue}%`
                      : priceFormatter(bundle.discountValue)}
                  </Text>
                </InlineStack>
              )}
              {bundle.price &&
                bundle.compareAtPrice &&
                bundle.price < bundle.compareAtPrice && (
                  <InlineStack align="space-between">
                    <Text as="span">Savings:</Text>
                    <Text as="span" fontWeight="semibold" tone="success">
                      {priceFormatter(bundle.compareAtPrice - bundle.price)} (
                      {Math.round(
                        ((bundle.compareAtPrice - bundle.price) /
                          bundle.compareAtPrice) *
                          100
                      )}
                      %)
                    </Text>
                  </InlineStack>
                )}
            </BlockStack>
          </Card>

          {/* Analytics */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Performance (30 days)
              </Text>
              <InlineStack align="space-between">
                <Text as="span">Views:</Text>
                <Text as="span" fontWeight="semibold">
                  {analytics.views.toLocaleString()}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Add to carts:</Text>
                <Text as="span" fontWeight="semibold">
                  {analytics.addToCarts.toLocaleString()}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Purchases:</Text>
                <Text as="span" fontWeight="semibold">
                  {analytics.purchases.toLocaleString()}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Revenue:</Text>
                <Text as="span" fontWeight="semibold">
                  {priceFormatter(analytics.revenue)}
                </Text>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span">Conversion rate:</Text>
                <Text as="span" fontWeight="semibold">
                  {analytics.views > 0
                    ? ((analytics.purchases / analytics.views) * 100).toFixed(1)
                    : 0}
                  %
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Settings */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Settings
              </Text>
              <InlineStack align="space-between">
                <Text as="span">Track inventory:</Text>
                <Text as="span">{bundle.trackInventory ? "Yes" : "No"}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Show compare price:</Text>
                <Text as="span">{bundle.showCompareAtPrice ? "Yes" : "No"}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Show savings:</Text>
                <Text as="span">{bundle.showSavingsAmount ? "Yes" : "No"}</Text>
              </InlineStack>
              {bundle.type === BundleType.MIX_MATCH && (
                <>
                  <InlineStack align="space-between">
                    <Text as="span">Min products:</Text>
                    <Text as="span">{bundle.minProducts || "None"}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span">Max products:</Text>
                    <Text as="span">{bundle.maxProducts || "Unlimited"}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span">Allow duplicates:</Text>
                    <Text as="span">{bundle.allowDuplicates ? "Yes" : "No"}</Text>
                  </InlineStack>
                </>
              )}
            </BlockStack>
          </Card>

          {/* Meta */}
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Handle: {bundle.handle}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Created: {new Date(bundle.createdAt).toLocaleDateString()}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Updated: {new Date(bundle.updatedAt).toLocaleDateString()}
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </InlineGrid>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
