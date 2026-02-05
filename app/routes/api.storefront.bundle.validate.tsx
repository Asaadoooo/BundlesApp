import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import { BundleType } from "~/types/bundle";
import { calculateBundlePricing, isBundleScheduleActive } from "~/utils/bundle.server";

interface ValidateRequest {
  shop: string;
  bundleId: string;
  selectedItems?: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    price: number;
  }>;
  tierId?: string;
  quantity?: number;
}

// POST /api/storefront/bundle/validate - Validate customer selections
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: ValidateRequest = await request.json();
    const { shop, bundleId, selectedItems = [], tierId, quantity = 1 } = body;

    if (!shop) {
      return Response.json({ error: "Shop is required" }, { status: 400 });
    }

    if (!bundleId) {
      return Response.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    // Authenticate storefront request
    const { admin } = await unauthenticated.admin(shop);

    // Fetch bundle
    const bundle = await prisma.bundle.findFirst({
      where: {
        id: bundleId,
        shop,
        status: { in: ["active", "scheduled"] },
      },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
        categories: {
          include: { items: true },
        },
      },
    });

    if (!bundle) {
      return Response.json(
        {
          isValid: false,
          errors: ["Bundle not found"],
          pricing: null,
        },
        {
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Check if bundle is active
    if (!isBundleScheduleActive(bundle)) {
      return Response.json(
        {
          isValid: false,
          errors: ["Bundle not currently available"],
          pricing: null,
        },
        {
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Type-specific validation
    switch (bundle.type) {
      case BundleType.FIXED:
        // Fixed bundles are always valid if bundle exists
        break;

      case BundleType.MIX_MATCH:
        const totalProducts = selectedItems.reduce((sum, i) => sum + i.quantity, 0);

        if (bundle.minProducts && totalProducts < bundle.minProducts) {
          errors.push(`Select at least ${bundle.minProducts} products`);
        }

        if (bundle.maxProducts && totalProducts > bundle.maxProducts) {
          errors.push(`Maximum ${bundle.maxProducts} products allowed`);
        }

        // Validate category constraints
        for (const category of bundle.categories) {
          const categoryItemIds = category.items.map((i) => i.shopifyVariantId);
          const selectedFromCategory = selectedItems.filter((s) =>
            categoryItemIds.includes(s.variantId)
          );
          const categoryTotal = selectedFromCategory.reduce(
            (sum, i) => sum + i.quantity,
            0
          );

          if (category.minSelect && categoryTotal < category.minSelect) {
            errors.push(
              `${category.name}: select at least ${category.minSelect} items`
            );
          }

          if (category.maxSelect && categoryTotal > category.maxSelect) {
            errors.push(
              `${category.name}: maximum ${category.maxSelect} items`
            );
          }
        }

        // Check for duplicates if not allowed
        if (!bundle.allowDuplicates) {
          const seen = new Set<string>();
          for (const item of selectedItems) {
            if (seen.has(item.variantId)) {
              errors.push("Duplicate products are not allowed in this bundle");
              break;
            }
            seen.add(item.variantId);
          }
        }
        break;

      case BundleType.TIERED:
        if (!tierId) {
          errors.push("Please select a tier");
        } else {
          const selectedTier = bundle.tiers.find((t) => t.id === tierId);
          if (!selectedTier) {
            errors.push("Invalid tier selected");
          } else {
            const tierProductCount = selectedItems.reduce(
              (sum, i) => sum + i.quantity,
              0
            );
            if (tierProductCount < selectedTier.productCount) {
              errors.push(
                `Select ${selectedTier.productCount - tierProductCount} more products for ${selectedTier.name}`
              );
            } else if (tierProductCount > selectedTier.productCount) {
              errors.push(
                `${selectedTier.name} allows only ${selectedTier.productCount} products`
              );
            }
          }
        }
        break;

      case BundleType.VOLUME:
        if (selectedItems.length === 0) {
          errors.push("Please select items");
        } else {
          const totalQty = selectedItems.reduce((sum, i) => sum + i.quantity, 0) * quantity;
          const qualifyingRule = bundle.volumeRules.find(
            (rule) =>
              totalQty >= rule.minQuantity &&
              (rule.maxQuantity === null || totalQty <= rule.maxQuantity)
          );

          if (!qualifyingRule && bundle.volumeRules.length > 0) {
            const minQty = Math.min(...bundle.volumeRules.map((r) => r.minQuantity));
            warnings.push(
              `Add ${minQty - totalQty} more to qualify for a discount`
            );
          }
        }
        break;
    }

    // Check inventory availability
    if (selectedItems.length > 0) {
      const variantIds = selectedItems
        .filter((item) => item.variantId)
        .map((item) =>
          item.variantId.startsWith("gid://")
            ? item.variantId
            : `gid://shopify/ProductVariant/${item.variantId}`
        );

      if (variantIds.length > 0) {
        const inventoryQuery = `#graphql
          query CheckInventory($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on ProductVariant {
                id
                availableForSale
                quantityAvailable
                title
                product {
                  title
                }
              }
            }
          }
        `;

        const inventoryResponse = await admin.graphql(inventoryQuery, {
          variables: { ids: variantIds },
        });
        const inventoryJson = await inventoryResponse.json();

        if (inventoryJson.data?.nodes) {
          for (const node of inventoryJson.data.nodes) {
            if (!node) continue;

            const selectedItem = selectedItems.find(
              (item) =>
                item.variantId === node.id ||
                `gid://shopify/ProductVariant/${item.variantId}` === node.id
            );

            if (selectedItem) {
              const requiredQty = selectedItem.quantity * quantity;
              const available = node.quantityAvailable || 0;

              if (!node.availableForSale) {
                errors.push(`${node.product.title} is not available`);
              } else if (available < requiredQty) {
                errors.push(
                  `Only ${available} of ${node.product.title} available`
                );
              }
            }
          }
        }
      }
    }

    // Calculate pricing
    let pricing = null;
    if (errors.length === 0) {
      pricing = calculateBundlePricing(
        bundle,
        selectedItems,
        tierId,
        quantity
      );
    }

    return Response.json(
      {
        isValid: errors.length === 0,
        errors,
        warnings,
        pricing,
      },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("Error validating bundle:", error);
    return Response.json(
      {
        isValid: false,
        errors: ["Validation failed"],
        pricing: null,
      },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
};

// Handle preflight requests
export const loader = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
