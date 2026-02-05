import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// GraphQL query to get inventory for variants
const INVENTORY_QUERY = `#graphql
  query GetInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryQuantity
        product {
          id
        }
      }
    }
  }
`;

// GET /api/inventory/sync - Sync inventory from Shopify for all active bundles
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const bundleId = url.searchParams.get("bundleId"); // Optional: sync specific bundle

  try {
    // Get bundles to sync
    const whereClause: Record<string, unknown> = {
      shop,
      status: { in: ["active", "scheduled"] },
      trackInventory: true,
    };

    if (bundleId) {
      whereClause.id = bundleId;
    }

    const bundles = await prisma.bundle.findMany({
      where: whereClause,
      include: {
        items: true,
      },
    });

    if (bundles.length === 0) {
      return Response.json({ message: "No bundles to sync", synced: 0 });
    }

    // Collect all unique variant IDs across all bundles
    const allVariantIds = new Set<string>();
    for (const bundle of bundles) {
      for (const item of bundle.items) {
        if (item.shopifyVariantId) {
          const variantId = item.shopifyVariantId.startsWith("gid://")
            ? item.shopifyVariantId
            : `gid://shopify/ProductVariant/${item.shopifyVariantId}`;
          allVariantIds.add(variantId);
        }
      }
    }

    if (allVariantIds.size === 0) {
      return Response.json({ message: "No variants to sync", synced: 0 });
    }

    // Fetch inventory in batches (Shopify has limits on nodes query)
    const variantIdsArray = Array.from(allVariantIds);
    const batchSize = 50;
    const inventoryMap = new Map<string, number>();

    for (let i = 0; i < variantIdsArray.length; i += batchSize) {
      const batch = variantIdsArray.slice(i, i + batchSize);

      const response = await admin.graphql(INVENTORY_QUERY, {
        variables: { ids: batch },
      });

      const responseJson = await response.json();

      if (responseJson.errors) {
        console.error("GraphQL errors:", responseJson.errors);
        continue;
      }

      for (const node of responseJson.data.nodes) {
        if (node) {
          inventoryMap.set(node.id, node.inventoryQuantity || 0);
        }
      }
    }

    // Calculate and store inventory snapshots for each bundle
    const syncResults = [];

    for (const bundle of bundles) {
      let minAvailableBundles = Infinity;
      let limitingProduct: string | null = null;
      let limitingVariant: string | null = null;
      let limitingStock: number | null = null;

      for (const item of bundle.items) {
        if (!item.shopifyVariantId) continue;

        const variantId = item.shopifyVariantId.startsWith("gid://")
          ? item.shopifyVariantId
          : `gid://shopify/ProductVariant/${item.shopifyVariantId}`;

        const available = inventoryMap.get(variantId) || 0;
        const required = item.quantity;

        const bundlesAvailable =
          required > 0 ? Math.floor(available / required) : Infinity;

        if (bundlesAvailable < minAvailableBundles) {
          minAvailableBundles = bundlesAvailable;
          limitingProduct = item.shopifyProductId;
          limitingVariant = item.shopifyVariantId;
          limitingStock = available;
        }
      }

      // Create inventory snapshot
      const snapshot = await prisma.bundleInventorySnapshot.create({
        data: {
          bundleId: bundle.id,
          isAvailable: minAvailableBundles > 0,
          availableCount:
            minAvailableBundles === Infinity ? 0 : minAvailableBundles,
          limitingProduct,
          limitingVariant,
          limitingStock,
        },
      });

      syncResults.push({
        bundleId: bundle.id,
        bundleTitle: bundle.title,
        isAvailable: snapshot.isAvailable,
        availableCount: snapshot.availableCount,
        limitingProduct: snapshot.limitingProduct,
      });
    }

    // Clean up old snapshots (keep only last 100 per bundle)
    for (const bundle of bundles) {
      const oldSnapshots = await prisma.bundleInventorySnapshot.findMany({
        where: { bundleId: bundle.id },
        orderBy: { checkedAt: "desc" },
        skip: 100,
        select: { id: true },
      });

      if (oldSnapshots.length > 0) {
        await prisma.bundleInventorySnapshot.deleteMany({
          where: {
            id: { in: oldSnapshots.map((s) => s.id) },
          },
        });
      }
    }

    return Response.json({
      message: `Synced inventory for ${bundles.length} bundles`,
      synced: bundles.length,
      results: syncResults,
    });
  } catch (error) {
    console.error("Error syncing inventory:", error);
    return Response.json(
      { error: "Failed to sync inventory", details: String(error) },
      { status: 500 }
    );
  }
};
