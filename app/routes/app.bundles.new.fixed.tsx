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
  Checkbox,
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
    fixedPrice,
    showCompareAtPrice,
    showSavingsAmount,
    trackInventory,
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

  // Calculate total price from products
  const totalOriginalPrice = products.reduce(
    (sum: number, p: any) => sum + p.price * p.quantity,
    0
  );

  // Determine final price based on discount type
  let price = fixedPrice;
  if (discountType === "percentage" && discountValue) {
    price = totalOriginalPrice * (1 - discountValue / 100);
  } else if (discountType === "fixed_amount" && discountValue) {
    price = totalOriginalPrice - discountValue;
  }

  const bundle = await prisma.bundle.create({
    data: {
      shop,
      title,
      description,
      handle,
      type: BundleType.FIXED,
      status: status || BundleStatus.DRAFT,
      price,
      compareAtPrice: totalOriginalPrice,
      discountType: discountType || null,
      discountValue: discountValue || null,
      showCompareAtPrice: showCompareAtPrice ?? true,
      showSavingsAmount: showSavingsAmount ?? true,
      trackInventory: trackInventory ?? true,
      items: {
        create: products.map((product: any, index: number) => ({
          shopifyProductId: product.productId,
          shopifyVariantId: product.variantId,
          productTitle: product.productTitle,
          variantTitle: product.variantTitle,
          productImage: product.imageUrl,
          sku: product.sku,
          quantity: product.quantity,
          position: index,
          isRequired: true,
          originalPrice: product.price,
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

export default function NewFixedBundlePage() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountTypeValue>("fixed_price");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [fixedPrice, setFixedPrice] = useState<number>(0);
  const [showCompareAtPrice, setShowCompareAtPrice] = useState(true);
  const [showSavingsAmount, setShowSavingsAmount] = useState(true);
  const [trackInventory, setTrackInventory] = useState(true);
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [displayProduct, setDisplayProduct] = useState<{ id: string; title: string } | null>(null);

  const totalOriginalPrice = products.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  );

  const calculateFinalPrice = useCallback(() => {
    if (discountType === "fixed_price") {
      return fixedPrice;
    } else if (discountType === "percentage") {
      return totalOriginalPrice * (1 - discountValue / 100);
    } else if (discountType === "fixed_amount") {
      return Math.max(0, totalOriginalPrice - discountValue);
    }
    return totalOriginalPrice;
  }, [discountType, fixedPrice, discountValue, totalOriginalPrice]);

  const finalPrice = calculateFinalPrice();
  const savings = totalOriginalPrice - finalPrice;
  const savingsPercent =
    totalOriginalPrice > 0 ? (savings / totalOriginalPrice) * 100 : 0;


  const handleSubmit = useCallback(
    (status: string) => {
      if (!title.trim()) {
        shopify.toast.show("Please enter a bundle title", { isError: true });
        return;
      }

      if (products.length === 0) {
        shopify.toast.show("Please add at least one product", { isError: true });
        return;
      }

      if (discountType === "fixed_price" && fixedPrice <= 0) {
        shopify.toast.show("Please enter a valid bundle price", { isError: true });
        return;
      }

      const data = {
        title,
        description,
        discountType,
        discountValue,
        fixedPrice,
        showCompareAtPrice,
        showSavingsAmount,
        trackInventory,
        products,
        status,
      };

      fetcher.submit({ data: JSON.stringify(data) }, { method: "POST" });
    },
    [
      title,
      description,
      discountType,
      discountValue,
      fixedPrice,
      showCompareAtPrice,
      showSavingsAmount,
      trackInventory,
      products,
      fetcher,
      shopify,
    ]
  );

  const isSubmitting = fetcher.state === "submitting";

  return (
    <Page
      title="Create Fixed Bundle"
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
            titlePlaceholder="e.g., Holiday Gift Set"
            displayProduct={displayProduct}
            onDisplayProductChange={setDisplayProduct}
          />

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Products in bundle
              </Text>
              <Text as="p" tone="subdued">
                Add the products that will be included in this fixed bundle.
                All products are required for the bundle.
              </Text>
              <ProductPicker
                selectedProducts={products}
                onSelectionChange={setProducts}
                showQuantity={true}
                allowDuplicates={true}
              />
            </BlockStack>
          </Card>

          <PricingSection
            discountType={discountType}
            onDiscountTypeChange={setDiscountType}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
            fixedPrice={fixedPrice}
            onFixedPriceChange={setFixedPrice}
            showFixedPrice={true}
          />

          {/* Display Settings */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Display settings
              </Text>
              <Checkbox
                label="Show compare at price (strikethrough)"
                checked={showCompareAtPrice}
                onChange={setShowCompareAtPrice}
              />
              <Checkbox
                label="Show savings amount"
                checked={showSavingsAmount}
                onChange={setShowSavingsAmount}
              />
              <Checkbox
                label="Track inventory (disable bundle when out of stock)"
                checked={trackInventory}
                onChange={setTrackInventory}
              />
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Preview Sidebar */}
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" fontWeight="bold">
                Price preview
              </Text>

              {products.length > 0 ? (
                <>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">Original price:</Text>
                      <Text as="span" tone="subdued" textDecorationLine="line-through">
                        {formatPrice(totalOriginalPrice)}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" fontWeight="bold">Bundle price:</Text>
                      <Text as="span" fontWeight="bold" tone="success">
                        {formatPrice(finalPrice)}
                      </Text>
                    </InlineStack>
                    {savings > 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" tone="success">Savings:</Text>
                        <Text as="span" tone="success">
                          {formatPrice(savings)} ({savingsPercent.toFixed(0)}%)
                        </Text>
                      </InlineStack>
                    )}
                  </BlockStack>

                  <Divider />

                  <Text as="p" fontWeight="semibold">Included products:</Text>
                  <BlockStack gap="100">
                    {products.map((product) => (
                      <Text key={product.variantId} as="p" variant="bodySm">
                        {product.quantity}x {product.productTitle}
                        {product.variantTitle && ` - ${product.variantTitle}`}
                      </Text>
                    ))}
                  </BlockStack>
                </>
              ) : (
                <Text as="p" tone="subdued">
                  Add products to see the price preview
                </Text>
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
                  Set a bundle price lower than the sum of individual prices
                </List.Item>
                <List.Item>
                  Include complementary products that work well together
                </List.Item>
                <List.Item>
                  Use descriptive titles that highlight the value
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
