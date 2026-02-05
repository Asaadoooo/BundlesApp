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
  Select,
  Checkbox,
  Button,
  Box,
  Divider,
  List,
  InlineGrid,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { generateHandle } from "~/utils/bundle.server";
import { formatPrice } from "~/utils/bundle";
import { BundleStatus, BundleType, DiscountType } from "~/types/bundle";
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

  const {
    title,
    description,
    applyToSameProduct,
    combineWithDiscounts,
    volumeRules,
    products,
    status,
  } = data;

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
      type: BundleType.VOLUME,
      status: status || BundleStatus.DRAFT,
      applyToSameProduct: applyToSameProduct ?? false,
      combineWithDiscounts: combineWithDiscounts ?? false,
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
      volumeRules: {
        create: volumeRules.map((rule: any, index: number) => ({
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity || null,
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          label: rule.label,
          position: index,
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

interface VolumeRule {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  discountType: string;
  discountValue: number;
  label: string;
}

export default function NewVolumeBundlePage() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [applyToSameProduct, setApplyToSameProduct] = useState(false);
  const [combineWithDiscounts, setCombineWithDiscounts] = useState(false);
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [volumeRules, setVolumeRules] = useState<VolumeRule[]>([
    {
      id: "1",
      minQuantity: 3,
      maxQuantity: 5,
      discountType: "percentage",
      discountValue: 10,
      label: "Buy 3-5, get 10% off",
    },
    {
      id: "2",
      minQuantity: 6,
      maxQuantity: 9,
      discountType: "percentage",
      discountValue: 15,
      label: "Buy 6-9, get 15% off",
    },
    {
      id: "3",
      minQuantity: 10,
      maxQuantity: null,
      discountType: "percentage",
      discountValue: 20,
      label: "Buy 10+, get 20% off",
    },
  ]);


  const addRule = useCallback(() => {
    const lastRule = volumeRules[volumeRules.length - 1];
    const newMinQty = lastRule ? (lastRule.maxQuantity || lastRule.minQuantity) + 1 : 1;

    setVolumeRules((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        minQuantity: newMinQty,
        maxQuantity: null,
        discountType: "percentage",
        discountValue: 0,
        label: "",
      },
    ]);
  }, [volumeRules]);

  const removeRule = useCallback((ruleId: string) => {
    setVolumeRules((prev) => prev.filter((r) => r.id !== ruleId));
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<VolumeRule>) => {
    setVolumeRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  }, []);

  const generateLabel = useCallback((rule: VolumeRule) => {
    const qtyPart = rule.maxQuantity
      ? `Buy ${rule.minQuantity}-${rule.maxQuantity}`
      : `Buy ${rule.minQuantity}+`;

    const discountPart =
      rule.discountType === "percentage"
        ? `get ${rule.discountValue}% off`
        : `save ${formatPrice(rule.discountValue)}`;

    return `${qtyPart}, ${discountPart}`;
  }, []);

  const handleSubmit = useCallback(
    (status: string) => {
      if (!title.trim()) {
        shopify.toast.show("Please enter a bundle title", { isError: true });
        return;
      }

      if (volumeRules.length === 0) {
        shopify.toast.show("Please add at least one volume discount rule", {
          isError: true,
        });
        return;
      }

      // Validate rules
      for (const rule of volumeRules) {
        if (rule.minQuantity < 1) {
          shopify.toast.show("Minimum quantity must be at least 1", {
            isError: true,
          });
          return;
        }
        if (rule.discountValue <= 0) {
          shopify.toast.show("Discount value must be greater than 0", {
            isError: true,
          });
          return;
        }
      }

      const data = {
        title,
        description,
        applyToSameProduct,
        combineWithDiscounts,
        products,
        volumeRules: volumeRules.map((rule) => ({
          ...rule,
          label: rule.label || generateLabel(rule),
        })),
        status,
      };

      fetcher.submit({ data: JSON.stringify(data) }, { method: "POST" });
    },
    [
      title,
      description,
      applyToSameProduct,
      combineWithDiscounts,
      products,
      volumeRules,
      generateLabel,
      fetcher,
      shopify,
    ]
  );

  const isSubmitting = fetcher.state === "submitting";

  const discountTypeOptions = [
    { label: "Percentage off", value: "percentage" },
    { label: "Fixed amount off", value: "fixed_amount" },
  ];

  return (
    <Page
      title="Create Volume Discount"
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
            titlePlaceholder="e.g., Bulk Discount - Buy More Save More"
            descriptionPlaceholder="Describe your volume discount..."
          />

          {/* Volume Rules */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd" fontWeight="bold">
                  Discount tiers
                </Text>
                <Button onClick={addRule}>Add tier</Button>
              </InlineStack>
              <Text as="p" tone="subdued">
                Set up tiered discounts based on quantity purchased.
              </Text>

              {volumeRules.map((rule, index) => (
                <Box
                  key={rule.id}
                  padding="400"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" fontWeight="semibold">
                        Tier {index + 1}
                      </Text>
                      {volumeRules.length > 1 && (
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() => removeRule(rule.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </InlineStack>

                    <InlineStack gap="400">
                      <TextField
                        label="Min quantity"
                        type="number"
                        value={String(rule.minQuantity)}
                        onChange={(value) =>
                          updateRule(rule.id, {
                            minQuantity: parseInt(value) || 1,
                          })
                        }
                        autoComplete="off"
                      />
                      <TextField
                        label="Max quantity (optional)"
                        type="number"
                        value={String(rule.maxQuantity || "")}
                        onChange={(value) =>
                          updateRule(rule.id, {
                            maxQuantity: value ? parseInt(value) : null,
                          })
                        }
                        helpText="Leave empty for unlimited"
                        autoComplete="off"
                      />
                    </InlineStack>

                    <InlineStack gap="400">
                      <Select
                        label="Discount type"
                        options={discountTypeOptions}
                        value={rule.discountType}
                        onChange={(value) =>
                          updateRule(rule.id, { discountType: value })
                        }
                      />
                      <TextField
                        label="Discount value"
                        type="number"
                        value={String(rule.discountValue)}
                        onChange={(value) =>
                          updateRule(rule.id, {
                            discountValue: parseFloat(value) || 0,
                          })
                        }
                        suffix={rule.discountType === "percentage" ? "%" : ""}
                        prefix={rule.discountType === "fixed_amount" ? "€" : ""}
                        autoComplete="off"
                      />
                    </InlineStack>

                    <TextField
                      label="Display label (optional)"
                      value={rule.label}
                      onChange={(value) =>
                        updateRule(rule.id, { label: value })
                      }
                      placeholder={generateLabel(rule)}
                      helpText="Leave empty to auto-generate"
                      autoComplete="off"
                    />
                  </BlockStack>
                </Box>
              ))}
            </BlockStack>
          </Card>

          {/* Settings */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Settings
              </Text>
              <Checkbox
                label="Only apply when buying the same product"
                checked={applyToSameProduct}
                onChange={setApplyToSameProduct}
              />
              <Checkbox
                label="Allow combining with other discounts"
                checked={combineWithDiscounts}
                onChange={setCombineWithDiscounts}
              />
            </BlockStack>
          </Card>

          {/* Applicable Products */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Applicable products (optional)
              </Text>
              <Text as="p" tone="subdued">
                Leave empty to apply to all products, or select specific
                products for this volume discount.
              </Text>
              <ProductPicker
                selectedProducts={products}
                onSelectionChange={setProducts}
                showQuantity={false}
                allowDuplicates={false}
              />
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Preview Sidebar */}
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Discount preview
              </Text>

              <BlockStack gap="200">
                {volumeRules.map((rule) => (
                  <Box
                    key={rule.id}
                    padding="300"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                  >
                    <BlockStack gap="100">
                      <Text as="p" fontWeight="semibold">
                        {rule.maxQuantity
                          ? `${rule.minQuantity} - ${rule.maxQuantity} items`
                          : `${rule.minQuantity}+ items`}
                      </Text>
                      <Text as="p" tone="success">
                        {rule.discountType === "percentage"
                          ? `${rule.discountValue}% off`
                          : `${formatPrice(rule.discountValue)} off each`}
                      </Text>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Applies to:</Text>
                  <Text as="span" fontWeight="semibold">
                    {products.length === 0
                      ? "All products"
                      : `${products.length} products`}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Same product only:</Text>
                  <Text as="span" fontWeight="semibold">
                    {applyToSameProduct ? "Yes" : "No"}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Tips
              </Text>
              <List>
                <List.Item>
                  Start with lower discounts for smaller quantities
                </List.Item>
                <List.Item>
                  Make the discount tiers easy to understand
                </List.Item>
                <List.Item>
                  Consider your profit margins at each tier
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
