import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateHandle, validateBundle } from "~/utils/bundle.server";
import { BundleStatus, BundleType } from "~/types/bundle";

// GET /api/bundles - List all bundles with pagination and filtering
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const type = url.searchParams.get("type") as BundleType | null;
  const status = url.searchParams.get("status") as BundleStatus | null;
  const search = url.searchParams.get("search");
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

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

  // Get total count
  const total = await prisma.bundle.count({ where });

  // Get bundles with pagination
  const bundles = await prisma.bundle.findMany({
    where,
    include: {
      items: true,
      tiers: true,
      volumeRules: true,
      categories: {
        include: {
          items: true,
        },
      },
      _count: {
        select: {
          analytics: true,
        },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return Response.json({
    data: bundles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  });
};

// POST /api/bundles - Create new bundle
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      type,
      status = BundleStatus.DRAFT,
      compareAtPrice,
      price,
      discountType,
      discountValue,
      showCompareAtPrice = true,
      showSavingsAmount = true,
      showSavingsPercent = false,
      trackInventory = true,
      continueWhenOutOfStock = false,
      minProducts,
      maxProducts,
      allowDuplicates = true,
      applyToSameProduct = false,
      combineWithDiscounts = false,
      startDate,
      endDate,
      metaTitle,
      metaDescription,
      imageUrl,
      items = [],
      tiers = [],
      volumeRules = [],
      categories = [],
    } = body;

    // Generate handle
    let handle = generateHandle(title);

    // Check for handle uniqueness
    const existingBundle = await prisma.bundle.findUnique({
      where: { shop_handle: { shop, handle } },
    });

    if (existingBundle) {
      handle = `${handle}-${Date.now()}`;
    }

    // Validate bundle
    const validation = validateBundle({
      title,
      type,
      price,
      discountType,
      items: items as any[],
      volumeRules: volumeRules as any[],
      tiers: tiers as any[],
      minProducts,
      maxProducts,
      startDate,
      endDate,
    });

    if (!validation.isValid) {
      return Response.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 }
      );
    }

    // Create bundle with nested items
    const bundle = await prisma.bundle.create({
      data: {
        shop,
        title,
        description,
        handle,
        type,
        status,
        compareAtPrice,
        price,
        discountType,
        discountValue,
        showCompareAtPrice,
        showSavingsAmount,
        showSavingsPercent,
        trackInventory,
        continueWhenOutOfStock,
        minProducts,
        maxProducts,
        allowDuplicates,
        applyToSameProduct,
        combineWithDiscounts,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        metaTitle,
        metaDescription,
        imageUrl,
        items: {
          create: items.map((item: any, index: number) => ({
            shopifyProductId: item.shopifyProductId,
            shopifyVariantId: item.shopifyVariantId,
            productTitle: item.productTitle,
            variantTitle: item.variantTitle,
            productImage: item.productImage,
            sku: item.sku,
            quantity: item.quantity || 1,
            position: item.position ?? index,
            isRequired: item.isRequired ?? true,
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice,
            minQuantity: item.minQuantity || 0,
            maxQuantity: item.maxQuantity,
          })),
        },
        tiers: {
          create: tiers.map((tier: any, index: number) => ({
            name: tier.name,
            description: tier.description,
            position: tier.position ?? index,
            price: tier.price,
            compareAtPrice: tier.compareAtPrice,
            productCount: tier.productCount,
            allowedProducts: tier.allowedProducts
              ? JSON.stringify(tier.allowedProducts)
              : null,
            featured: tier.featured || false,
            badgeText: tier.badgeText,
            imageUrl: tier.imageUrl,
          })),
        },
        volumeRules: {
          create: volumeRules.map((rule: any, index: number) => ({
            minQuantity: rule.minQuantity,
            maxQuantity: rule.maxQuantity,
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            label: rule.label,
            position: rule.position ?? index,
          })),
        },
        categories: {
          create: categories.map((category: any, index: number) => ({
            name: category.name,
            description: category.description,
            position: category.position ?? index,
            minSelect: category.minSelect || 0,
            maxSelect: category.maxSelect,
            imageUrl: category.imageUrl,
            collapsed: category.collapsed || false,
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

    return Response.json({ data: bundle }, { status: 201 });
  } catch (error) {
    console.error("Error creating bundle:", error);
    return Response.json(
      { error: "Failed to create bundle", details: String(error) },
      { status: 500 }
    );
  }
};
