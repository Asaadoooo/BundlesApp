// Bundle Types and Enums

export enum BundleType {
  FIXED = "FIXED",
  MIX_MATCH = "MIX_MATCH",
  VOLUME = "VOLUME",
  TIERED = "TIERED",
}

export enum BundleStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  SCHEDULED = "scheduled",
  ARCHIVED = "archived",
}

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
  FIXED_PRICE = "fixed_price",
  FIXED_PRICE_PER_ITEM = "fixed_price_per_item",
}

// API Request/Response Types

export interface CreateBundleRequest {
  title: string;
  description?: string;
  type: BundleType;
  status?: BundleStatus;

  // Pricing
  compareAtPrice?: number;
  price?: number;
  discountType?: DiscountType;
  discountValue?: number;

  // Display Settings
  showCompareAtPrice?: boolean;
  showSavingsAmount?: boolean;
  showSavingsPercent?: boolean;

  // Inventory Settings
  trackInventory?: boolean;
  continueWhenOutOfStock?: boolean;

  // Mix & Match Settings
  minProducts?: number;
  maxProducts?: number;
  allowDuplicates?: boolean;

  // Volume Bundle Settings
  applyToSameProduct?: boolean;
  combineWithDiscounts?: boolean;

  // Scheduling
  startDate?: string;
  endDate?: string;

  // SEO & Display
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;

  // Items (for fixed bundles)
  items?: CreateBundleItemRequest[];

  // Tiers (for tiered bundles)
  tiers?: CreateBundleTierRequest[];

  // Volume Rules (for volume bundles)
  volumeRules?: CreateVolumeRuleRequest[];

  // Categories (for mix & match)
  categories?: CreateBundleCategoryRequest[];
}

export interface UpdateBundleRequest extends Partial<CreateBundleRequest> {
  id: string;
}

export interface CreateBundleItemRequest {
  shopifyProductId: string;
  shopifyVariantId?: string;
  productTitle: string;
  variantTitle?: string;
  productImage?: string;
  sku?: string;
  quantity?: number;
  position?: number;
  isRequired?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  categoryId?: string;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface CreateBundleTierRequest {
  name: string;
  description?: string;
  position?: number;
  price: number;
  compareAtPrice?: number;
  productCount: number;
  allowedProducts?: string[];
  featured?: boolean;
  badgeText?: string;
  imageUrl?: string;
}

export interface CreateVolumeRuleRequest {
  minQuantity: number;
  maxQuantity?: number;
  discountType: DiscountType;
  discountValue: number;
  label?: string;
  position?: number;
}

export interface CreateBundleCategoryRequest {
  name: string;
  description?: string;
  position?: number;
  minSelect?: number;
  maxSelect?: number;
  imageUrl?: string;
  collapsed?: boolean;
  items?: CreateBundleItemRequest[];
}

// Response Types

export interface BundleResponse {
  id: string;
  shop: string;
  title: string;
  description: string | null;
  handle: string;
  type: BundleType;
  status: BundleStatus;

  compareAtPrice: number | null;
  price: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;

  showCompareAtPrice: boolean;
  showSavingsAmount: boolean;
  showSavingsPercent: boolean;

  trackInventory: boolean;
  continueWhenOutOfStock: boolean;

  minProducts: number | null;
  maxProducts: number | null;
  allowDuplicates: boolean;

  applyToSameProduct: boolean;
  combineWithDiscounts: boolean;

  startDate: string | null;
  endDate: string | null;

  metaTitle: string | null;
  metaDescription: string | null;
  imageUrl: string | null;

  shopifyProductId: string | null;

  createdAt: string;
  updatedAt: string;

  items: BundleItemResponse[];
  tiers: BundleTierResponse[];
  volumeRules: VolumeRuleResponse[];
  categories: BundleCategoryResponse[];
}

export interface BundleItemResponse {
  id: string;
  bundleId: string;
  shopifyProductId: string;
  shopifyVariantId: string | null;
  productTitle: string;
  variantTitle: string | null;
  productImage: string | null;
  sku: string | null;
  quantity: number;
  position: number;
  isRequired: boolean;
  originalPrice: number | null;
  discountedPrice: number | null;
  categoryId: string | null;
  minQuantity: number;
  maxQuantity: number | null;
}

export interface BundleTierResponse {
  id: string;
  bundleId: string;
  name: string;
  description: string | null;
  position: number;
  price: number;
  compareAtPrice: number | null;
  productCount: number;
  allowedProducts: string[] | null;
  featured: boolean;
  badgeText: string | null;
  imageUrl: string | null;
}

export interface VolumeRuleResponse {
  id: string;
  bundleId: string;
  minQuantity: number;
  maxQuantity: number | null;
  discountType: DiscountType;
  discountValue: number;
  label: string | null;
  position: number;
}

export interface BundleCategoryResponse {
  id: string;
  bundleId: string;
  name: string;
  description: string | null;
  position: number;
  minSelect: number;
  maxSelect: number | null;
  imageUrl: string | null;
  collapsed: boolean;
  items: BundleItemResponse[];
}

// Pricing Calculation Types

export interface PricingCalculationRequest {
  bundleId: string;
  selectedItems: SelectedItem[];
  tierId?: string;
  quantity?: number;
}

export interface SelectedItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
}

export interface PricingCalculationResponse {
  originalPrice: number;
  discountedPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  itemPrices: ItemPrice[];
  appliedDiscount: AppliedDiscount | null;
  isValid: boolean;
  validationErrors: string[];
}

export interface ItemPrice {
  productId: string;
  variantId: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
}

export interface AppliedDiscount {
  type: DiscountType;
  value: number;
  label: string;
}

// Inventory Types

export interface InventoryCheckRequest {
  bundleId: string;
  selectedItems?: SelectedItem[];
  quantity?: number;
}

export interface InventoryCheckResponse {
  isAvailable: boolean;
  availableQuantity: number;
  items: InventoryItemStatus[];
  limitingItem: InventoryItemStatus | null;
}

export interface InventoryItemStatus {
  productId: string;
  variantId: string;
  title: string;
  available: number;
  required: number;
  isLimiting: boolean;
}

// Analytics Types

export interface BundleAnalyticsResponse {
  bundleId: string;
  bundleTitle: string;
  period: string;
  metrics: BundleMetrics;
  dailyData: DailyAnalytics[];
}

export interface BundleMetrics {
  totalViews: number;
  totalAddToCarts: number;
  totalPurchases: number;
  totalRevenue: number;
  conversionRate: number;
  averageOrderValue: number;
  averageDiscount: number;
}

export interface DailyAnalytics {
  date: string;
  views: number;
  addToCartCount: number;
  purchaseCount: number;
  revenue: number;
  conversionRate: number;
}

export interface DashboardAnalytics {
  totalBundles: number;
  activeBundles: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topBundles: TopBundle[];
  recentActivity: RecentActivity[];
  periodComparison: PeriodComparison;
}

export interface TopBundle {
  id: string;
  title: string;
  type: BundleType;
  revenue: number;
  orders: number;
  conversionRate: number;
}

export interface RecentActivity {
  id: string;
  type: "purchase" | "view" | "add_to_cart";
  bundleId: string;
  bundleTitle: string;
  timestamp: string;
  details: string;
}

export interface PeriodComparison {
  currentPeriod: PeriodMetrics;
  previousPeriod: PeriodMetrics;
  revenueChange: number;
  ordersChange: number;
}

export interface PeriodMetrics {
  revenue: number;
  orders: number;
  views: number;
}

// Storefront Types

export interface StorefrontBundleRequest {
  bundleId: string;
}

export interface StorefrontBundleResponse {
  id: string;
  title: string;
  description: string | null;
  type: BundleType;
  imageUrl: string | null;

  // Pricing display
  displayPrice: number;
  compareAtPrice: number | null;
  savingsAmount: number | null;
  savingsPercent: number | null;

  // Availability
  isAvailable: boolean;
  availableQuantity: number;

  // Type-specific data
  items?: StorefrontBundleItem[];
  tiers?: StorefrontBundleTier[];
  categories?: StorefrontBundleCategory[];
  volumeRules?: StorefrontVolumeRule[];

  // Selection constraints
  minProducts?: number;
  maxProducts?: number;
}

export interface StorefrontBundleItem {
  productId: string;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  isRequired: boolean;
  available: boolean;
  availableQuantity: number;
}

export interface StorefrontBundleTier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  productCount: number;
  featured: boolean;
  badgeText: string | null;
  imageUrl: string | null;
}

export interface StorefrontBundleCategory {
  id: string;
  name: string;
  description: string | null;
  minSelect: number;
  maxSelect: number | null;
  imageUrl: string | null;
  items: StorefrontBundleItem[];
}

export interface StorefrontVolumeRule {
  minQuantity: number;
  maxQuantity: number | null;
  discountType: DiscountType;
  discountValue: number;
  label: string;
  pricePerItem?: number;
}

export interface AddToCartRequest {
  bundleId: string;
  selectedItems: SelectedItem[];
  tierId?: string;
  quantity?: number;
}

export interface AddToCartResponse {
  success: boolean;
  cartItems: CartItem[];
  error?: string;
}

export interface CartItem {
  variantId: string;
  quantity: number;
  properties: Record<string, string>;
}

// Pagination Types

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Filter Types

export interface BundleFilters {
  type?: BundleType;
  status?: BundleStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

// Validation Types

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
