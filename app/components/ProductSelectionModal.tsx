import { useState, useCallback, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Box,
  Text,
  BlockStack,
  InlineStack,
  Thumbnail,
  Modal,
  TextField,
  Spinner,
  Checkbox,
  Badge,
  Scrollable,
  Divider,
} from "@shopify/polaris";

export interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  variants: Variant[];
}

export interface Variant {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  availableForSale: boolean;
  imageUrl: string | null;
}

export interface SelectedVariant {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  sku: string | null;
}

interface ProductSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (variants: SelectedVariant[]) => void;
  excludeVariantIds?: string[];
  allowDuplicates?: boolean;
  maxSelections?: number;
  title?: string;
}

export function ProductSelectionModal({
  open,
  onClose,
  onSelect,
  excludeVariantIds = [],
  allowDuplicates = true,
  maxSelections,
  title = "Select products",
}: ProductSelectionModalProps) {
  const fetcher = useFetcher<{ data: Product[]; pageInfo: { hasNextPage: boolean; endCursor: string } }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Map<string, SelectedVariant>>(new Map());

  useEffect(() => {
    if (open && searchQuery.length >= 2) {
      const debounce = setTimeout(() => {
        fetcher.load(`/api/products/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
      }, 300);
      return () => clearTimeout(debounce);
    } else if (open && searchQuery.length === 0) {
      fetcher.load(`/api/products/search?query=&limit=20`);
    }
  }, [searchQuery, open]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedVariants(new Map());
      setSearchQuery("");
    }
  }, [open]);

  const isVariantExcluded = useCallback(
    (variantId: string) => {
      if (allowDuplicates) return false;
      return excludeVariantIds.includes(variantId);
    },
    [excludeVariantIds, allowDuplicates]
  );

  const isVariantSelected = useCallback(
    (variantId: string) => selectedVariants.has(variantId),
    [selectedVariants]
  );

  const canSelectMore = maxSelections === undefined || selectedVariants.size < maxSelections;

  const toggleVariantSelection = useCallback(
    (product: Product, variant: Variant) => {
      setSelectedVariants((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(variant.id)) {
          newMap.delete(variant.id);
        } else if (canSelectMore) {
          newMap.set(variant.id, {
            productId: product.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title !== "Default Title" ? variant.title : null,
            imageUrl: variant.imageUrl || product.imageUrl,
            price: variant.price,
            sku: variant.sku,
          });
        }
        return newMap;
      });
    },
    [canSelectMore]
  );

  const selectAllVariants = useCallback(
    (product: Product) => {
      setSelectedVariants((prev) => {
        const newMap = new Map(prev);
        const availableVariants = product.variants.filter(
          (v) => !isVariantExcluded(v.id) && !newMap.has(v.id)
        );

        for (const variant of availableVariants) {
          if (maxSelections !== undefined && newMap.size >= maxSelections) break;
          newMap.set(variant.id, {
            productId: product.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title !== "Default Title" ? variant.title : null,
            imageUrl: variant.imageUrl || product.imageUrl,
            price: variant.price,
            sku: variant.sku,
          });
        }
        return newMap;
      });
    },
    [isVariantExcluded, maxSelections]
  );

  const deselectAllVariants = useCallback((product: Product) => {
    setSelectedVariants((prev) => {
      const newMap = new Map(prev);
      for (const variant of product.variants) {
        newMap.delete(variant.id);
      }
      return newMap;
    });
  }, []);

  const handleAddSelected = useCallback(() => {
    const variants = Array.from(selectedVariants.values());
    onSelect(variants);
    onClose();
  }, [selectedVariants, onSelect, onClose]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const getProductSelectionState = (product: Product): "all" | "some" | "none" => {
    const selectableVariants = product.variants.filter((v) => !isVariantExcluded(v.id));
    const selectedCount = selectableVariants.filter((v) => isVariantSelected(v.id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === selectableVariants.length) return "all";
    return "some";
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: `Add ${selectedVariants.size} product${selectedVariants.size !== 1 ? "s" : ""}`,
        onAction: handleAddSelected,
        disabled: selectedVariants.size === 0,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Search Row */}
          <TextField
            label="Search products"
            labelHidden
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search products"
            autoFocus
            clearButton
            onClearButtonClick={() => setSearchQuery("")}
            autoComplete="off"
          />

          <Divider />

          {/* Loading State */}
          {fetcher.state === "loading" && (
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          )}

          {/* Product List */}
          {fetcher.data?.data && fetcher.data.data.length > 0 && (
            <Scrollable style={{ maxHeight: "400px" }}>
              <BlockStack gap="0">
                {fetcher.data.data.map((product) => {
                  const selectionState = getProductSelectionState(product);
                  const hasMultipleVariants = product.variants.length > 1;
                  const hasSingleVariant = product.variants.length === 1;
                  const singleVariant = hasSingleVariant ? product.variants[0] : null;

                  return (
                    <Box key={product.id}>
                      {/* Product Row */}
                      <Box
                        padding="300"
                        borderBlockEndWidth="025"
                        borderColor="border"
                      >
                        <InlineStack gap="300" align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            {/* Checkbox for single variant products */}
                            {hasSingleVariant && singleVariant && (
                              <Checkbox
                                label=""
                                labelHidden
                                checked={isVariantSelected(singleVariant.id)}
                                disabled={isVariantExcluded(singleVariant.id) || (!isVariantSelected(singleVariant.id) && !canSelectMore)}
                                onChange={() => toggleVariantSelection(product, singleVariant)}
                              />
                            )}
                            {/* Checkbox for multi-variant products */}
                            {hasMultipleVariants && (
                              <Checkbox
                                label=""
                                labelHidden
                                checked={selectionState !== "none"}
                                onChange={() =>
                                  selectionState === "all" || selectionState === "some"
                                    ? deselectAllVariants(product)
                                    : selectAllVariants(product)
                                }
                                disabled={!canSelectMore && selectionState === "none"}
                              />
                            )}
                            <Thumbnail
                              source={product.imageUrl || ""}
                              alt={product.title}
                              size="small"
                            />
                            <Box minWidth="150px">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {product.title}
                              </Text>
                            </Box>
                          </InlineStack>

                          {/* Show availability and price for single variant */}
                          {hasSingleVariant && singleVariant && (
                            <InlineStack gap="300" blockAlign="center">
                              <Box minWidth="80px">
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  {singleVariant.inventoryQuantity} available
                                </Text>
                              </Box>
                              <Box minWidth="70px">
                                <InlineStack align="end">
                                  <Text as="span" variant="bodyMd">
                                    {formatPrice(singleVariant.price)}
                                  </Text>
                                </InlineStack>
                              </Box>
                            </InlineStack>
                          )}
                        </InlineStack>
                      </Box>

                      {/* Variants for multi-variant products */}
                      {hasMultipleVariants && (
                        <Box paddingInlineStart="1600" background="bg-surface-secondary">
                          {product.variants.map((variant, index) => {
                            const isExcluded = isVariantExcluded(variant.id);
                            const isSelected = isVariantSelected(variant.id);
                            const isDisabled = isExcluded || (!isSelected && !canSelectMore);
                            const isLastVariant = index === product.variants.length - 1;

                            return (
                              <Box
                                key={variant.id}
                                padding="300"
                                borderBlockEndWidth={isLastVariant ? "0" : "025"}
                                borderColor="border"
                              >
                                <InlineStack gap="300" align="space-between" blockAlign="center">
                                  <InlineStack gap="300" blockAlign="center">
                                    <Checkbox
                                      label=""
                                      labelHidden
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onChange={() => toggleVariantSelection(product, variant)}
                                    />
                                    <Box minWidth="150px">
                                      <Text as="span" variant="bodyMd">
                                        {variant.title === "Default Title" ? product.title : variant.title}
                                      </Text>
                                    </Box>
                                  </InlineStack>

                                  <InlineStack gap="300" blockAlign="center">
                                    <Box minWidth="80px">
                                      <Text as="span" variant="bodyMd" tone="subdued">
                                        {variant.inventoryQuantity} available
                                      </Text>
                                    </Box>
                                    <Box minWidth="70px">
                                      <InlineStack align="end" gap="200">
                                        <Text as="span" variant="bodyMd">
                                          {formatPrice(variant.price)}
                                        </Text>
                                        {isExcluded && (
                                          <Badge tone="info">Added</Badge>
                                        )}
                                      </InlineStack>
                                    </Box>
                                  </InlineStack>
                                </InlineStack>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </BlockStack>
            </Scrollable>
          )}

          {/* Empty State */}
          {fetcher.data?.data && fetcher.data.data.length === 0 && searchQuery && (
            <Box padding="400">
              <Text as="p" tone="subdued" alignment="center">
                No products found for "{searchQuery}"
              </Text>
            </Box>
          )}

          {/* Footer with selection count */}
          <Divider />
          <Box>
            <Text as="p" variant="bodyMd" tone="subdued">
              {selectedVariants.size} product{selectedVariants.size !== 1 ? "s" : ""} selected
            </Text>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}