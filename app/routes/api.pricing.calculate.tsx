import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateBundlePricing } from "~/utils/bundle.server";
import type { PricingCalculationRequest, SelectedItem } from "~/types/bundle";

// POST /api/pricing/calculate - Calculate bundle price in real-time
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: PricingCalculationRequest = await request.json();
    const { bundleId, selectedItems, tierId, quantity = 1 } = body;

    if (!bundleId) {
      return Response.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    // Fetch bundle with all relations
    const bundle = await prisma.bundle.findFirst({
      where: { id: bundleId, shop },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
      },
    });

    if (!bundle) {
      return Response.json({ error: "Bundle not found" }, { status: 404 });
    }

    // If no selected items provided, use bundle's default items
    let itemsToCalculate: SelectedItem[] = selectedItems || [];

    if (itemsToCalculate.length === 0 && bundle.items.length > 0) {
      // Fetch current prices from Shopify
      const variantIds = bundle.items
        .filter((item) => item.shopifyVariantId)
        .map((item) =>
          item.shopifyVariantId!.startsWith("gid://")
            ? item.shopifyVariantId!
            : `gid://shopify/ProductVariant/${item.shopifyVariantId}`
        );

      if (variantIds.length > 0) {
        const priceQuery = `#graphql
          query GetPrices($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on ProductVariant {
                id
                price
              }
            }
          }
        `;

        const priceResponse = await admin.graphql(priceQuery, {
          variables: { ids: variantIds },
        });
        const priceJson = await priceResponse.json();

        const priceMap = new Map<string, number>();
        if (priceJson.data?.nodes) {
          for (const node of priceJson.data.nodes) {
            if (node?.id && node?.price) {
              priceMap.set(node.id, parseFloat(node.price));
            }
          }
        }

        // Build selected items from bundle items
        itemsToCalculate = bundle.items.map((item) => {
          const variantId = item.shopifyVariantId!.startsWith("gid://")
            ? item.shopifyVariantId!
            : `gid://shopify/ProductVariant/${item.shopifyVariantId}`;

          return {
            productId: item.shopifyProductId,
            variantId: item.shopifyVariantId || "",
            quantity: item.quantity,
            price: priceMap.get(variantId) || item.originalPrice || 0,
          };
        });
      }
    }

    // Calculate pricing
    const pricing = calculateBundlePricing(
      bundle,
      itemsToCalculate,
      tierId,
      quantity
    );

    return Response.json(pricing);
  } catch (error) {
    console.error("Error calculating pricing:", error);
    return Response.json(
      { error: "Failed to calculate pricing", details: String(error) },
      { status: 500 }
    );
  }
};
