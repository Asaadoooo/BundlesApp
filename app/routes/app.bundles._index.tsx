import { useState, useCallback, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  EmptyState,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { BundleStatus, BundleType } from "~/types/bundle";
import { getEffectiveStatus } from "~/utils/bundle";
import { BundleFilters } from "~/components/BundleFilters";
import { BundleTable } from "~/components/BundleTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const type = url.searchParams.get("type") as BundleType | null;
  const status = url.searchParams.get("status") as BundleStatus | null;
  const search = url.searchParams.get("search");

  // Build where clause
  const where: Record<string, unknown> = { shop };

  if (type) {
    where.type = type;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  // Get total count (filtered)
  const total = await prisma.bundle.count({ where });

  // Get total bundles count (unfiltered) to know if shop has any bundles
  const totalBundles = await prisma.bundle.count({ where: { shop } });

  // Get bundles with pagination
  const bundles = await prisma.bundle.findMany({
    where,
    include: {
      items: {
        select: { id: true },
      },
      _count: {
        select: {
          items: true,
          analytics: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Transform bundles for display
  const transformedBundles = bundles.map((bundle) => ({
    id: bundle.id,
    title: bundle.title,
    type: bundle.type,
    status: bundle.status,
    effectiveStatus: getEffectiveStatus(bundle),
    price: bundle.price,
    itemCount: bundle._count.items,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
  }));

  return {
    bundles: transformedBundles,
    totalBundles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");
  const bundleId = formData.get("bundleId") as string;

  if (action === "delete" && bundleId) {
    await prisma.bundle.delete({
      where: { id: bundleId },
    });
    return Response.json({ success: true, action: "delete" });
  }

  if (action === "duplicate" && bundleId) {
    const original = await prisma.bundle.findFirst({
      where: { id: bundleId, shop },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
        categories: true,
      },
    });

    if (original) {
      const newBundle = await prisma.bundle.create({
        data: {
          shop,
          title: `${original.title} (Copy)`,
          description: original.description,
          handle: `${original.handle}-copy-${Date.now()}`,
          type: original.type,
          status: BundleStatus.DRAFT,
          compareAtPrice: original.compareAtPrice,
          price: original.price,
          discountType: original.discountType,
          discountValue: original.discountValue,
          showCompareAtPrice: original.showCompareAtPrice,
          showSavingsAmount: original.showSavingsAmount,
          showSavingsPercent: original.showSavingsPercent,
          trackInventory: original.trackInventory,
          continueWhenOutOfStock: original.continueWhenOutOfStock,
          minProducts: original.minProducts,
          maxProducts: original.maxProducts,
          allowDuplicates: original.allowDuplicates,
          applyToSameProduct: original.applyToSameProduct,
          combineWithDiscounts: original.combineWithDiscounts,
          metaTitle: original.metaTitle,
          metaDescription: original.metaDescription,
          imageUrl: original.imageUrl,
          items: {
            create: original.items.map((item) => ({
              shopifyProductId: item.shopifyProductId,
              shopifyVariantId: item.shopifyVariantId,
              productTitle: item.productTitle,
              variantTitle: item.variantTitle,
              productImage: item.productImage,
              sku: item.sku,
              quantity: item.quantity,
              position: item.position,
              isRequired: item.isRequired,
              originalPrice: item.originalPrice,
              discountedPrice: item.discountedPrice,
              minQuantity: item.minQuantity,
              maxQuantity: item.maxQuantity,
            })),
          },
          tiers: {
            create: original.tiers.map((tier) => ({
              name: tier.name,
              description: tier.description,
              position: tier.position,
              price: tier.price,
              compareAtPrice: tier.compareAtPrice,
              productCount: tier.productCount,
              allowedProducts: tier.allowedProducts,
              featured: tier.featured,
              badgeText: tier.badgeText,
              imageUrl: tier.imageUrl,
            })),
          },
          volumeRules: {
            create: original.volumeRules.map((rule) => ({
              minQuantity: rule.minQuantity,
              maxQuantity: rule.maxQuantity,
              discountType: rule.discountType,
              discountValue: rule.discountValue,
              label: rule.label,
              position: rule.position,
            })),
          },
        },
      });
      return Response.json({ success: true, action: "duplicate", newBundleId: newBundle.id });
    }
  }

  if (action === "activate" && bundleId) {
    await prisma.bundle.update({
      where: { id: bundleId },
      data: { status: BundleStatus.ACTIVE },
    });
    return Response.json({ success: true, action: "activate" });
  }

  if (action === "deactivate" && bundleId) {
    await prisma.bundle.update({
      where: { id: bundleId },
      data: { status: BundleStatus.DRAFT },
    });
    return Response.json({ success: true, action: "deactivate" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

export default function BundlesPage() {
  const { bundles, totalBundles, pagination } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [selectedType, setSelectedType] = useState(searchParams.get("type") || "");
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || "");

  // Auto-filter when any filter changes (debounced for search)
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (selectedType) params.set("type", selectedType);
    if (selectedStatus) params.set("status", selectedStatus);

    const timeoutId = setTimeout(() => {
      setSearchParams(params);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue, selectedType, selectedStatus, setSearchParams]);

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      if (confirm(`Are you sure you want to delete ${ids.length} bundles?`)) {
        ids.forEach((id) => {
          fetcher.submit({ action: "delete", bundleId: id }, { method: "POST" });
        });
      }
    },
    [fetcher]
  );

  const handleBulkActivate = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => {
        fetcher.submit({ action: "activate", bundleId: id }, { method: "POST" });
      });
      shopify.toast.show(`${ids.length} bundles activated`);
    },
    [fetcher, shopify]
  );

  const handleBulkDeactivate = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => {
        fetcher.submit({ action: "deactivate", bundleId: id }, { method: "POST" });
      });
      shopify.toast.show(`${ids.length} bundles deactivated`);
    },
    [fetcher, shopify]
  );

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "delete") {
        shopify.toast.show("Bundle deleted");
      } else if (fetcher.data.action === "duplicate") {
        shopify.toast.show("Bundle duplicated");
        navigate(`/app/bundles/${fetcher.data.newBundleId}`);
      } else if (fetcher.data.action === "activate") {
        shopify.toast.show("Bundle activated");
      } else if (fetcher.data.action === "deactivate") {
        shopify.toast.show("Bundle deactivated");
      }
    }
  }, [fetcher.data, shopify, navigate]);

  return (
    <Page
      title="Bundles"
      primaryAction={{
        content: "Create bundle",
        onAction: () => navigate("/app/bundles/new"),
      }}
    >
      <BlockStack gap="500">
        {totalBundles === 0 ? (
          <Card>
            <EmptyState
              heading="Create your first bundle"
              action={{
                content: "Create bundle",
                onAction: () => navigate("/app/bundles/new"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Bundle products together to offer discounts and increase sales.
                Create fixed bundles, mix and match offers, volume discounts, or
                tiered pricing.
              </p>
            </EmptyState>
          </Card>
        ) : (
          <BundleTable
            bundles={bundles}
            onNavigate={(id) => navigate(`/app/bundles/${id}`)}
            onBulkDelete={handleBulkDelete}
            onBulkActivate={handleBulkActivate}
            onBulkDeactivate={handleBulkDeactivate}
            filters={
              <BundleFilters
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
              />
            }
          />
        )}

        {pagination.totalPages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={pagination.hasPrevious}
              onPrevious={() => {
                const params = new URLSearchParams(searchParams);
                params.set("page", String(pagination.page - 1));
                setSearchParams(params);
              }}
              hasNext={pagination.hasNext}
              onNext={() => {
                const params = new URLSearchParams(searchParams);
                params.set("page", String(pagination.page + 1));
                setSearchParams(params);
              }}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
