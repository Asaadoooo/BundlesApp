import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import type { AddToCartRequest, AddToCartResponse, CartItem } from "~/types/bundle";
import { BundleType } from "~/types/bundle";
import { isBundleScheduleActive } from "~/utils/bundle.server";

// POST /api/storefront/bundle/add-to-cart - Add bundle to cart
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: AddToCartRequest & { shop: string } = await request.json();
    const { shop, bundleId, selectedItems, tierId, quantity = 1 } = body;

    if (!shop) {
      return Response.json({ error: "Shop is required" }, { status: 400 });
    }

    if (!bundleId) {
      return Response.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    // Authenticate storefront request
    await unauthenticated.admin(shop);

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
      return Response.json({
        success: false,
        cartItems: [],
        error: "Bundle not found",
      });
    }

    // Check if bundle is active
    if (!isBundleScheduleActive(bundle)) {
      return Response.json({
        success: false,
        cartItems: [],
        error: "Bundle not currently available",
      });
    }

    // Validate selection based on bundle type
    const validationErrors: string[] = [];
    let itemsToAdd = selectedItems || [];

    switch (bundle.type) {
      case BundleType.FIXED:
        // For fixed bundles, use the predefined items
        itemsToAdd = bundle.items.map((item) => ({
          productId: item.shopifyProductId,
          variantId: item.shopifyVariantId || "",
          quantity: item.quantity,
          price: item.originalPrice || 0,
        }));
        break;

      case BundleType.MIX_MATCH:
        // Validate min/max products
        const totalProducts = itemsToAdd.reduce((sum, i) => sum + i.quantity, 0);

        if (bundle.minProducts && totalProducts < bundle.minProducts) {
          validationErrors.push(
            `Minimum ${bundle.minProducts} products required`
          );
        }

        if (bundle.maxProducts && totalProducts > bundle.maxProducts) {
          validationErrors.push(
            `Maximum ${bundle.maxProducts} products allowed`
          );
        }

        // Validate category constraints
        for (const category of bundle.categories) {
          const categoryItemIds = category.items.map((i) => i.shopifyVariantId);
          const selectedFromCategory = itemsToAdd.filter((s) =>
            categoryItemIds.includes(s.variantId)
          );
          const categoryTotal = selectedFromCategory.reduce(
            (sum, i) => sum + i.quantity,
            0
          );

          if (category.minSelect && categoryTotal < category.minSelect) {
            validationErrors.push(
              `${category.name}: minimum ${category.minSelect} items required`
            );
          }

          if (category.maxSelect && categoryTotal > category.maxSelect) {
            validationErrors.push(
              `${category.name}: maximum ${category.maxSelect} items allowed`
            );
          }
        }
        break;

      case BundleType.TIERED:
        if (!tierId) {
          validationErrors.push("Please select a tier");
        } else {
          const selectedTier = bundle.tiers.find((t) => t.id === tierId);
          if (!selectedTier) {
            validationErrors.push("Invalid tier selected");
          } else {
            const tierProductCount = itemsToAdd.reduce(
              (sum, i) => sum + i.quantity,
              0
            );
            if (tierProductCount !== selectedTier.productCount) {
              validationErrors.push(
                `${selectedTier.name} requires exactly ${selectedTier.productCount} products`
              );
            }
          }
        }
        break;

      case BundleType.VOLUME:
        // Volume bundles just need items selected
        if (itemsToAdd.length === 0) {
          validationErrors.push("Please select items");
        }
        break;
    }

    if (validationErrors.length > 0) {
      return Response.json({
        success: false,
        cartItems: [],
        error: validationErrors.join(", "),
      });
    }

    // Build cart items
    const cartItems: CartItem[] = [];

    for (const item of itemsToAdd) {
      // Ensure variant ID is in numeric format for cart
      let variantId = item.variantId;
      if (variantId.startsWith("gid://shopify/ProductVariant/")) {
        variantId = variantId.replace("gid://shopify/ProductVariant/", "");
      }

      // Build properties for bundle tracking
      const properties: Record<string, string> = {
        _bundle_id: bundleId,
        _bundle_title: bundle.title,
        _bundle_type: bundle.type,
      };

      if (tierId) {
        const tier = bundle.tiers.find((t) => t.id === tierId);
        if (tier) {
          properties._bundle_tier = tier.name;
          properties._bundle_tier_id = tierId;
        }
      }

      // Add discount info as property
      if (bundle.discountType && bundle.discountValue) {
        properties._bundle_discount_type = bundle.discountType;
        properties._bundle_discount_value = String(bundle.discountValue);
      }

      cartItems.push({
        variantId,
        quantity: item.quantity * quantity,
        properties,
      });
    }

    // Track add to cart for analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.bundleAnalytics.upsert({
      where: {
        bundleId_date: {
          bundleId: bundle.id,
          date: today,
        },
      },
      update: {
        addToCartCount: { increment: 1 },
      },
      create: {
        bundleId: bundle.id,
        date: today,
        addToCartCount: 1,
      },
    });

    return Response.json(
      {
        success: true,
        cartItems,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error adding bundle to cart:", error);
    return Response.json({
      success: false,
      cartItems: [],
      error: "Failed to add bundle to cart",
    });
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
