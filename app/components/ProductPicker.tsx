import { useState, useCallback } from "react";
import {
  Box,
  Text,
  BlockStack,
  InlineStack,
  Thumbnail,
  Button,
} from "@shopify/polaris";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  DeleteIcon,
  PlusIcon,
} from "@shopify/polaris-icons";
import { ProductSelectionModal, type SelectedVariant } from "./ProductSelectionModal";

export interface SelectedProduct {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  sku: string | null;
}

interface ProductPickerProps {
  selectedProducts: SelectedProduct[];
  onSelectionChange: (products: SelectedProduct[]) => void;
  maxProducts?: number;
  allowDuplicates?: boolean;
  showQuantity?: boolean;
}

export function ProductPicker({
  selectedProducts,
  onSelectionChange,
  maxProducts,
  allowDuplicates = true,
  showQuantity = true,
}: ProductPickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProductsSelected = useCallback(
    (variants: SelectedVariant[]) => {
      const newProducts: SelectedProduct[] = variants.map((variant) => ({
        productId: variant.productId,
        variantId: variant.variantId,
        productTitle: variant.productTitle,
        variantTitle: variant.variantTitle,
        imageUrl: variant.imageUrl,
        price: variant.price,
        quantity: 1,
        sku: variant.sku,
      }));

      // Merge with existing products
      const updatedProducts = [...selectedProducts];

      for (const newProduct of newProducts) {
        const existingIndex = updatedProducts.findIndex(
          (p) => p.variantId === newProduct.variantId
        );

        if (existingIndex >= 0) {
          if (allowDuplicates) {
            // Increment quantity
            updatedProducts[existingIndex].quantity += 1;
          }
          // If not allowing duplicates, skip
        } else {
          // Check max products
          if (maxProducts && updatedProducts.length >= maxProducts) {
            break;
          }
          updatedProducts.push(newProduct);
        }
      }

      onSelectionChange(updatedProducts);
    },
    [selectedProducts, onSelectionChange, maxProducts, allowDuplicates]
  );

  const handleRemoveProduct = useCallback(
    (variantId: string) => {
      onSelectionChange(selectedProducts.filter((p) => p.variantId !== variantId));
    },
    [selectedProducts, onSelectionChange]
  );

  const handleQuantityChange = useCallback(
    (variantId: string, quantity: number) => {
      if (quantity < 1) return;
      const updated = selectedProducts.map((p) =>
        p.variantId === variantId ? { ...p, quantity } : p
      );
      onSelectionChange(updated);
    },
    [selectedProducts, onSelectionChange]
  );

  const handleMoveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= selectedProducts.length) return;

      const updated = [...selectedProducts];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onSelectionChange(updated);
    },
    [selectedProducts, onSelectionChange]
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const excludeVariantIds = allowDuplicates
    ? []
    : selectedProducts.map((p) => p.variantId);

  const remainingSlots = maxProducts ? maxProducts - selectedProducts.length : undefined;

  return (
    <BlockStack gap="400">
      {/* Selected products */}
      {selectedProducts.length > 0 && (
        <BlockStack gap="200">
          {selectedProducts.map((product, index) => (
            <Box
              key={`${product.variantId}-${index}`}
              padding="300"
              borderWidth="025"
              borderRadius="200"
              borderColor="border"
            >
              <InlineStack gap="300" align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Thumbnail
                    source={product.imageUrl || ""}
                    alt={product.productTitle}
                    size="small"
                  />
                  <BlockStack gap="100">
                    <Text as="span" fontWeight="semibold">{product.productTitle}</Text>
                    {product.variantTitle && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {product.variantTitle}
                      </Text>
                    )}
                    <Text as="span" variant="bodySm">{formatPrice(product.price)}</Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="400" blockAlign="center">
                  {showQuantity && (
                    <InlineStack gap="200" blockAlign="center">
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          handleQuantityChange(product.variantId, product.quantity - 1)
                        }
                        disabled={product.quantity <= 1}
                      >
                        -
                      </Button>
                      <Text as="span" fontWeight="bold">{product.quantity}</Text>
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          handleQuantityChange(product.variantId, product.quantity + 1)
                        }
                      >
                        +
                      </Button>
                    </InlineStack>
                  )}

                  <InlineStack gap="100">
                    <Button
                      variant="tertiary"
                      icon={ChevronUpIcon}
                      onClick={() => handleMoveItem(index, "up")}
                      disabled={index === 0}
                      accessibilityLabel="Move up"
                    />
                    <Button
                      variant="tertiary"
                      icon={ChevronDownIcon}
                      onClick={() => handleMoveItem(index, "down")}
                      disabled={index === selectedProducts.length - 1}
                      accessibilityLabel="Move down"
                    />
                    <Button
                      variant="tertiary"
                      icon={DeleteIcon}
                      tone="critical"
                      onClick={() => handleRemoveProduct(product.variantId)}
                      accessibilityLabel="Remove"
                    />
                  </InlineStack>
                </InlineStack>
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      )}

      {/* Add products button */}
      <Button
        icon={PlusIcon}
        onClick={() => setIsModalOpen(true)}
        disabled={maxProducts !== undefined && selectedProducts.length >= maxProducts}
      >
        {selectedProducts.length === 0 ? "Add products" : "Add more products"}
      </Button>

      {/* Product selection modal */}
      <ProductSelectionModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleProductsSelected}
        excludeVariantIds={excludeVariantIds}
        allowDuplicates={allowDuplicates}
        maxSelections={remainingSlots}
        title="Select products for bundle"
      />
    </BlockStack>
  );
}