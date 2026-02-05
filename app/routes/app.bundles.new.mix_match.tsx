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
import { PricingSection, type DiscountTypeValue } from "~/components/PricingSection";

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
    discountType,
    discountValue,
    minProducts,
    maxProducts,
    allowDuplicates,
    categories,
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
      type: BundleType.MIX_MATCH,
      status: status || BundleStatus.DRAFT,
      discountType: discountType || null,
      discountValue: discountValue || null,
      minProducts,
      maxProducts,
      allowDuplicates: allowDuplicates ?? true,
      showCompareAtPrice: true,
      showSavingsAmount: true,
      trackInventory: true,
    },
  });

  // Create categories with items
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const createdCategory = await prisma.bundleCategory.create({
      data: {
        bundleId: bundle.id,
        name: category.name,
        description: category.description,
        position: i,
        minSelect: category.minSelect || 0,
        maxSelect: category.maxSelect || null,
      },
    });

    // Create items for this category
    if (category.products && category.products.length > 0) {
      await prisma.bundleItem.createMany({
        data: category.products.map((product: any, index: number) => ({
          bundleId: bundle.id,
          categoryId: createdCategory.id,
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
          minQuantity: 0,
          maxQuantity: null,
        })),
      });
    }
  }

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

interface Category {
  id: string;
  name: string;
  description: string;
  minSelect: number;
  maxSelect: number | null;
  products: SelectedProduct[];
}

export default function NewMixMatchBundlePage() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountTypeValue>("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minProducts, setMinProducts] = useState<number>(3);
  const [maxProducts, setMaxProducts] = useState<number>(5);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [categories, setCategories] = useState<Category[]>([
    {
      id: "1",
      name: "Category 1",
      description: "",
      minSelect: 0,
      maxSelect: null,
      products: [],
    },
  ]);
  const [displayProduct, setDisplayProduct] = useState<{ id: string; title: string } | null>(null);

  const totalProducts = categories.reduce(
    (sum, cat) => sum + cat.products.length,
    0
  );


  const addCategory = useCallback(() => {
    setCategories((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Category ${prev.length + 1}`,
        description: "",
        minSelect: 0,
        maxSelect: null,
        products: [],
      },
    ]);
  }, []);

  const removeCategory = useCallback((categoryId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
  }, []);

  const updateCategory = useCallback(
    (categoryId: string, updates: Partial<Category>) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const handleSubmit = useCallback(
    (status: string) => {
      if (!title.trim()) {
        shopify.toast.show("Please enter a bundle title", { isError: true });
        return;
      }

      if (totalProducts === 0) {
        shopify.toast.show("Please add products to at least one category", { isError: true });
        return;
      }

      if (minProducts > maxProducts) {
        shopify.toast.show(
          "Minimum products cannot be greater than maximum products",
          { isError: true }
        );
        return;
      }

      const data = {
        title,
        description,
        discountType,
        discountValue,
        minProducts,
        maxProducts,
        allowDuplicates,
        categories: categories.map((c) => ({
          name: c.name,
          description: c.description,
          minSelect: c.minSelect,
          maxSelect: c.maxSelect,
          products: c.products,
        })),
        status,
      };

      const form = new FormData();
      form.append("data", JSON.stringify(data));
      fetcher.submit(form, { method: "post" });
    },
    [
      title,
      description,
      discountType,
      discountValue,
      minProducts,
      maxProducts,
      allowDuplicates,
      categories,
      totalProducts,
      fetcher,
      shopify,
    ]
  );

  const isSubmitting = fetcher.state === "submitting";

  return (
    <Page
      title="Create Mix & Match Bundle"
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
            titlePlaceholder="e.g., Build Your Own Gift Box"
            displayProduct={displayProduct}
            onDisplayProductChange={setDisplayProduct}
          />

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Selection rules
              </Text>
              <Text as="p" tone="subdued">
                Define how many products customers can select for their bundle.
              </Text>
              <InlineStack gap="400">
                <TextField
                  label="Minimum products"
                  type="number"
                  value={String(minProducts)}
                  onChange={(value) => setMinProducts(parseInt(value) || 1)}
                  autoComplete="off"
                />
                <TextField
                  label="Maximum products"
                  type="number"
                  value={String(maxProducts)}
                  onChange={(value) => setMaxProducts(parseInt(value) || 1)}
                  autoComplete="off"
                />
              </InlineStack>
              <Checkbox
                label="Allow customers to select the same product multiple times"
                checked={allowDuplicates}
                onChange={setAllowDuplicates}
              />
            </BlockStack>
          </Card>

          <PricingSection
            discountType={discountType}
            onDiscountTypeChange={setDiscountType}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
            showFixedPrice={false}
            title="Bundle discount"
          />

          {/* Categories */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd" fontWeight="bold">
                  Product categories
                </Text>
                <Button onClick={addCategory}>Add category</Button>
              </InlineStack>
              <Text as="p" tone="subdued">
                Organize products into categories. Customers will select from
                these categories to build their bundle.
              </Text>

              {categories.map((category, index) => (
                <Box
                  key={category.id}
                  padding="400"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" fontWeight="semibold">
                        Category {index + 1}
                      </Text>
                      {categories.length > 1 && (
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() => removeCategory(category.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </InlineStack>

                    <TextField
                      label="Category name"
                      value={category.name}
                      onChange={(value) =>
                        updateCategory(category.id, { name: value })
                      }
                      placeholder="e.g., Snacks, Drinks, Main Course"
                      autoComplete="off"
                    />

                    <TextField
                      label="Description (optional)"
                      value={category.description}
                      onChange={(value) =>
                        updateCategory(category.id, { description: value })
                      }
                      placeholder="Help customers understand this category"
                      autoComplete="off"
                    />

                    <InlineStack gap="400">
                      <TextField
                        label="Min selections"
                        type="number"
                        value={String(category.minSelect)}
                        onChange={(value) =>
                          updateCategory(category.id, {
                            minSelect: parseInt(value) || 0,
                          })
                        }
                        helpText="0 = optional"
                        autoComplete="off"
                      />
                      <TextField
                        label="Max selections"
                        type="number"
                        value={String(category.maxSelect || "")}
                        onChange={(value) =>
                          updateCategory(category.id, {
                            maxSelect: value ? parseInt(value) : null,
                          })
                        }
                        helpText="Empty = unlimited"
                        autoComplete="off"
                      />
                    </InlineStack>

                    <Text as="p" fontWeight="semibold">
                      Products ({category.products.length})
                    </Text>
                    <ProductPicker
                      selectedProducts={category.products}
                      onSelectionChange={(products) =>
                        updateCategory(category.id, { products })
                      }
                      showQuantity={false}
                      allowDuplicates={false}
                    />
                  </BlockStack>
                </Box>
              ))}
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Preview Sidebar */}
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Bundle preview
              </Text>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Selection range:</Text>
                  <Text as="span" fontWeight="semibold">
                    {minProducts} - {maxProducts} products
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Discount:</Text>
                  <Text as="span" fontWeight="semibold" tone="success">
                    {discountType === "percentage"
                      ? `${discountValue}% off`
                      : formatPrice(discountValue) + " off"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Available products:</Text>
                  <Text as="span" fontWeight="semibold">{totalProducts}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Categories:</Text>
                  <Text as="span" fontWeight="semibold">{categories.length}</Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              <Text as="p" fontWeight="semibold">Categories:</Text>
              <BlockStack gap="100">
                {categories.map((category) => (
                  <Text key={category.id} as="p" variant="bodySm">
                    {category.name} ({category.products.length} products)
                    {category.minSelect > 0 && ` - min ${category.minSelect}`}
                  </Text>
                ))}
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
                  Create logical categories (e.g., "Snacks", "Drinks")
                </List.Item>
                <List.Item>
                  Use minimum selections to ensure variety
                </List.Item>
                <List.Item>
                  Consider allowing duplicates for popular items
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
