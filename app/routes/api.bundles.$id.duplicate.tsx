import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateHandle } from "~/utils/bundle.server";
import { BundleStatus } from "~/types/bundle";

// POST /api/bundles/:id/duplicate - Duplicate a bundle
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!id) {
    return Response.json({ error: "Bundle ID is required" }, { status: 400 });
  }

  try {
    // Fetch original bundle with all relations
    const originalBundle = await prisma.bundle.findFirst({
      where: { id, shop },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
        categories: {
          include: { items: true },
        },
      },
    });

    if (!originalBundle) {
      return Response.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Get optional new title from request body
    let body: { title?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Generate new title and handle
    const newTitle = body.title || `${originalBundle.title} (Copy)`;
    let newHandle = generateHandle(newTitle);

    // Ensure unique handle
    const existingWithHandle = await prisma.bundle.findUnique({
      where: { shop_handle: { shop, handle: newHandle } },
    });
    if (existingWithHandle) {
      newHandle = `${newHandle}-${Date.now()}`;
    }

    // Create duplicated bundle
    const duplicatedBundle = await prisma.bundle.create({
      data: {
        shop,
        title: newTitle,
        description: originalBundle.description,
        handle: newHandle,
        type: originalBundle.type,
        status: BundleStatus.DRAFT, // Always start as draft
        compareAtPrice: originalBundle.compareAtPrice,
        price: originalBundle.price,
        discountType: originalBundle.discountType,
        discountValue: originalBundle.discountValue,
        showCompareAtPrice: originalBundle.showCompareAtPrice,
        showSavingsAmount: originalBundle.showSavingsAmount,
        showSavingsPercent: originalBundle.showSavingsPercent,
        trackInventory: originalBundle.trackInventory,
        continueWhenOutOfStock: originalBundle.continueWhenOutOfStock,
        minProducts: originalBundle.minProducts,
        maxProducts: originalBundle.maxProducts,
        allowDuplicates: originalBundle.allowDuplicates,
        applyToSameProduct: originalBundle.applyToSameProduct,
        combineWithDiscounts: originalBundle.combineWithDiscounts,
        startDate: null, // Clear schedule for duplicate
        endDate: null,
        metaTitle: originalBundle.metaTitle,
        metaDescription: originalBundle.metaDescription,
        imageUrl: originalBundle.imageUrl,
        // Don't copy shopifyProductId - needs to be synced separately
        items: {
          create: originalBundle.items
            .filter((item) => !item.categoryId)
            .map((item) => ({
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
          create: originalBundle.tiers.map((tier) => ({
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
          create: originalBundle.volumeRules.map((rule) => ({
            minQuantity: rule.minQuantity,
            maxQuantity: rule.maxQuantity,
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            label: rule.label,
            position: rule.position,
          })),
        },
      },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
        categories: true,
      },
    });

    // Handle categories with their items
    for (const category of originalBundle.categories) {
      const categoryItems = originalBundle.items.filter(
        (item) => item.categoryId === category.id
      );

      await prisma.bundleCategory.create({
        data: {
          bundleId: duplicatedBundle.id,
          name: category.name,
          description: category.description,
          position: category.position,
          minSelect: category.minSelect,
          maxSelect: category.maxSelect,
          imageUrl: category.imageUrl,
          collapsed: category.collapsed,
          items: {
            create: categoryItems.map((item) => ({
              bundleId: duplicatedBundle.id,
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
        },
      });
    }

    // Fetch complete duplicated bundle
    const completeDuplicate = await prisma.bundle.findUnique({
      where: { id: duplicatedBundle.id },
      include: {
        items: { orderBy: { position: "asc" } },
        tiers: { orderBy: { position: "asc" } },
        volumeRules: { orderBy: { position: "asc" } },
        categories: {
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
      },
    });

    return Response.json({ data: completeDuplicate }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating bundle:", error);
    return Response.json(
      { error: "Failed to duplicate bundle", details: String(error) },
      { status: 500 }
    );
  }
};
