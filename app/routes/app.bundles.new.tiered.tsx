import { useState, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Box,
  Divider,
  List,
  InlineGrid,
  Banner,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { generateHandle } from "~/utils/bundle.server";
import { formatPrice } from "~/utils/bundle";
import { BundleStatus, BundleType } from "~/types/bundle";
import { ProductPicker } from "~/components/ProductPicker";
import { BundleDetailsForm } from "~/components/BundleDetailsForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return Response.json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const data = JSON.parse(formData.get("data") as string);

  const { title, description, tiers, products, status } = data;

  // Generate handle
  let handle = generateHandle(title);
  const existingBundle = await prisma.bundle.findUnique({
    where: { shop_handle: { shop, handle } },
  });
  if (existingBundle) {
    handle = `${handle}-${Date.now()}`;
  }

  const bundle = await prisma.bundle.create({
    data: {
      shop,
      title,
      description,
      handle,
      type: BundleType.TIERED,
      status: status || BundleStatus.DRAFT,
      showCompareAtPrice: true,
      showSavingsAmount: true,
      trackInventory: true,
      items: {
        create: products.map((product: any, index: number) => ({
          shopifyProductId: product.productId,
          shopifyVariantId: product.variantId,
          productTitle: product.productTitle,
          variantTitle: product.variantTitle,
          productImage: product.imageUrl,
          sku: product.sku,
          quantity: 1,
          position: index,
          isRequired: false,
          originalPrice: product.price,
        })),
      },
      tiers: {
        create: tiers.map((tier: any, index: number) => ({
          name: tier.name,
          description: tier.description,
          position: index,
          price: tier.price,
          compareAtPrice: tier.compareAtPrice,
          productCount: tier.productCount,
          featured: tier.featured || false,
          badgeText: tier.badgeText,
        })),
      },
    },
  });

  return redirect(`/app/bundles/${bundle.id}`);
};

interface SelectedProduct {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  sku: string | null;
}

interface BundleTier {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  productCount: number;
  featured: boolean;
  badgeText: string;
}

export default function NewTieredBundlePage() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [displayProduct, setDisplayProduct] = useState<{ id: string; title: string } | null>(null);
  const [tiers, setTiers] = useState<BundleTier[]>([
    {
      id: "1",
      name: "Basic",
      description: "Perfect for trying out",
      price: 35,
      compareAtPrice: 45,
      productCount: 3,
      featured: false,
      badgeText: "",
    },
    {
      id: "2",
      name: "Premium",
      description: "Our most popular choice",
      price: 65,
      compareAtPrice: 85,
      productCount: 6,
      featured: true,
      badgeText: "Most Popular",
    },
    {
      id: "3",
      name: "Deluxe",
      description: "The ultimate experience",
      price: 95,
      compareAtPrice: 130,
      productCount: 10,
      featured: false,
      badgeText: "Best Value",
    },
  ]);


  const addTier = useCallback(() => {
    const lastTier = tiers[tiers.length - 1];
    setTiers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Tier ${prev.length + 1}`,
        description: "",
        price: lastTier ? lastTier.price + 30 : 50,
        compareAtPrice: null,
        productCount: lastTier ? lastTier.productCount + 3 : 3,
        featured: false,
        badgeText: "",
      },
    ]);
  }, [tiers]);

  const removeTier = useCallback((tierId: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== tierId));
  }, []);

  const updateTier = useCallback((tierId: string, updates: Partial<BundleTier>) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, ...updates } : t))
    );
  }, []);

  const setFeaturedTier = useCallback((tierId: string) => {
    setTiers((prev) =>
      prev.map((t) => ({ ...t, featured: t.id === tierId }))
    );
  }, []);

  const handleSubmit = useCallback(
    (status: string) => {
      if (!title.trim()) {
        shopify.toast.show("Please enter a bundle title", { isError: true });
        return;
      }

      if (tiers.length === 0) {
        shopify.toast.show("Please add at least one tier", { isError: true });
        return;
      }

      if (products.length === 0) {
        shopify.toast.show("Please add products for selection", { isError: true });
        return;
      }

      // Validate tiers
      for (const tier of tiers) {
        if (tier.price <= 0) {
          shopify.toast.show("All tier prices must be greater than 0", {
            isError: true,
          });
          return;
        }
        if (tier.productCount < 1) {
          shopify.toast.show("All tiers must have at least 1 product", {
            isError: true,
          });
          return;
        }
        if (tier.productCount > products.length) {
          shopify.toast.show(
            `Tier "${tier.name}" requires ${tier.productCount} products but only ${products.length} are available`,
            { isError: true }
          );
          return;
        }
      }

      const data = {
        title,
        description,
        tiers,
        products,
        status,
      };

      fetcher.submit({ data: JSON.stringify(data) }, { method: "POST" });
    },
    [title, description, tiers, products, fetcher, shopify]
  );

  const isSubmitting = fetcher.state === "submitting";

  return (
    <Page
      title="Create Tiered Bundle"
      backAction={{
        content: "Bundle types",
        onAction: () => navigate("/app/bundles/new"),
      }}
      primaryAction={{
        content: "Save and publish",
        onAction: () => handleSubmit(BundleStatus.ACTIVE),
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
      secondaryActions={[
        {
          content: "Save as draft",
          onAction: () => handleSubmit(BundleStatus.DRAFT),
          loading: isSubmitting,
          disabled: isSubmitting,
        },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
        <BlockStack gap="400">
          <BundleDetailsForm
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            titlePlaceholder="e.g., Holiday Gift Collection"
            descriptionPlaceholder="Describe your tiered bundle..."
            displayProduct={displayProduct}
            onDisplayProductChange={setDisplayProduct}
          />

          {/* Tiers */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd" fontWeight="bold">
                  Bundle tiers
                </Text>
                <Button onClick={addTier}>Add tier</Button>
              </InlineStack>
              <Text as="p" tone="subdued">
                Create different pricing tiers (e.g., Bronze, Silver, Gold).
                Each tier offers a different number of products at a fixed price.
              </Text>

              {tiers.map((tier, index) => (
                <Box
                  key={tier.id}
                  padding="400"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                  background={tier.featured ? "bg-surface-success" : undefined}
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h3" fontWeight="semibold">
                          Tier {index + 1}
                        </Text>
                        {tier.featured && (
                          <Badge tone="success">Featured</Badge>
                        )}
                      </InlineStack>
                      <InlineStack gap="200">
                        {!tier.featured && (
                          <Button
                            variant="plain"
                            onClick={() => setFeaturedTier(tier.id)}
                          >
                            Set as featured
                          </Button>
                        )}
                        {tiers.length > 1 && (
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => removeTier(tier.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </InlineStack>
                    </InlineStack>

                    <InlineStack gap="400">
                      <TextField
                        label="Tier name"
                        value={tier.name}
                        onChange={(value) =>
                          updateTier(tier.id, { name: value })
                        }
                        placeholder="e.g., Basic, Premium, Deluxe"
                        autoComplete="off"
                      />
                      <TextField
                        label="Badge text (optional)"
                        value={tier.badgeText}
                        onChange={(value) =>
                          updateTier(tier.id, { badgeText: value })
                        }
                        placeholder="e.g., Most Popular, Best Value"
                        autoComplete="off"
                      />
                    </InlineStack>

                    <TextField
                      label="Description"
                      value={tier.description}
                      onChange={(value) =>
                        updateTier(tier.id, { description: value })
                      }
                      placeholder="Brief description of this tier"
                      autoComplete="off"
                    />

                    <InlineStack gap="400">
                      <TextField
                        label="Tier price"
                        type="number"
                        value={String(tier.price)}
                        onChange={(value) =>
                          updateTier(tier.id, {
                            price: parseFloat(value) || 0,
                          })
                        }
                        prefix="€"
                        autoComplete="off"
                      />
                      <TextField
                        label="Compare at price (optional)"
                        type="number"
                        value={String(tier.compareAtPrice || "")}
                        onChange={(value) =>
                          updateTier(tier.id, {
                            compareAtPrice: value ? parseFloat(value) : null,
                          })
                        }
                        prefix="€"
                        helpText="Original value for strikethrough"
                        autoComplete="off"
                      />
                      <TextField
                        label="Products included"
                        type="number"
                        value={String(tier.productCount)}
                        onChange={(value) =>
                          updateTier(tier.id, {
                            productCount: parseInt(value) || 1,
                          })
                        }
                        autoComplete="off"
                      />
                    </InlineStack>
                  </BlockStack>
                </Box>
              ))}
            </BlockStack>
          </Card>

          {/* Available Products */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Available products
              </Text>
              <Text as="p" tone="subdued">
                Add products that customers can choose from when building their
                bundle. Make sure to add enough products for the largest tier.
              </Text>
              <ProductPicker
                selectedProducts={products}
                onSelectionChange={setProducts}
                showQuantity={false}
                allowDuplicates={false}
              />
              {products.length > 0 && (
                <Text as="p" variant="bodySm" tone="subdued">
                  {products.length} products available for selection
                </Text>
              )}
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Preview Sidebar */}
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Tier preview
              </Text>

              {tiers.map((tier) => (
                <Box
                  key={tier.id}
                  padding="400"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                  background={tier.featured ? "bg-surface-success" : undefined}
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" fontWeight="bold">{tier.name}</Text>
                      {tier.badgeText && (
                        <Badge tone={tier.featured ? "success" : "info"}>
                          {tier.badgeText}
                        </Badge>
                      )}
                    </InlineStack>

                    <InlineStack gap="200" blockAlign="baseline">
                      <Text as="p" fontWeight="bold" variant="headingLg">
                        {formatPrice(tier.price)}
                      </Text>
                      {tier.compareAtPrice && (
                        <Text as="p" tone="subdued" textDecorationLine="line-through">
                          {formatPrice(tier.compareAtPrice)}
                        </Text>
                      )}
                    </InlineStack>

                    <Text as="p" variant="bodySm">
                      {tier.productCount} products
                    </Text>

                    {tier.compareAtPrice && tier.compareAtPrice > tier.price && (
                      <Text as="p" variant="bodySm" tone="success">
                        Save {formatPrice(tier.compareAtPrice - tier.price)} (
                        {Math.round(
                          ((tier.compareAtPrice - tier.price) /
                            tier.compareAtPrice) *
                            100
                        )}
                        % off)
                      </Text>
                    )}
                  </BlockStack>
                </Box>
              ))}

              <Divider />

              <InlineStack align="space-between">
                <Text as="span">Available products:</Text>
                <Text as="span" fontWeight="semibold">{products.length}</Text>
              </InlineStack>

              {tiers.some((t) => t.productCount > products.length) && (
                <Banner tone="warning">
                  Add more products! Some tiers require more products than
                  currently available.
                </Banner>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Tips
              </Text>
              <List>
                <List.Item>
                  Create 3 tiers for optimal choice architecture
                </List.Item>
                <List.Item>
                  Feature the tier you want customers to choose most
                </List.Item>
                <List.Item>
                  Make the value proposition clear at each tier
                </List.Item>
              </List>
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
