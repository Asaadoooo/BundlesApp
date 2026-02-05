-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "handle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "compareAtPrice" REAL,
    "price" REAL,
    "discountType" TEXT,
    "discountValue" REAL,
    "showCompareAtPrice" BOOLEAN NOT NULL DEFAULT true,
    "showSavingsAmount" BOOLEAN NOT NULL DEFAULT true,
    "showSavingsPercent" BOOLEAN NOT NULL DEFAULT false,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "continueWhenOutOfStock" BOOLEAN NOT NULL DEFAULT false,
    "minProducts" INTEGER,
    "maxProducts" INTEGER,
    "allowDuplicates" BOOLEAN NOT NULL DEFAULT true,
    "applyToSameProduct" BOOLEAN NOT NULL DEFAULT false,
    "combineWithDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "imageUrl" TEXT,
    "shopifyProductId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "productImage" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "originalPrice" REAL,
    "discountedPrice" REAL,
    "categoryId" TEXT,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "maxQuantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BundleCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "imageUrl" TEXT,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleCategory_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "productCount" INTEGER NOT NULL,
    "allowedProducts" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "badgeText" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleTier_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VolumeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "label" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VolumeRule_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "addToCartCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" REAL NOT NULL DEFAULT 0,
    "averageOrderValue" REAL NOT NULL DEFAULT 0,
    "averageDiscount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleAnalytics_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundlePurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "discountAmount" REAL NOT NULL,
    "tierName" TEXT,
    "selectedItems" TEXT,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BundleInventorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "availableCount" INTEGER NOT NULL,
    "limitingProduct" TEXT,
    "limitingVariant" TEXT,
    "limitingStock" INTEGER,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Bundle_shop_idx" ON "Bundle"("shop");

-- CreateIndex
CREATE INDEX "Bundle_status_idx" ON "Bundle"("status");

-- CreateIndex
CREATE INDEX "Bundle_type_idx" ON "Bundle"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_shop_handle_key" ON "Bundle"("shop", "handle");

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_idx" ON "BundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "BundleItem_shopifyProductId_idx" ON "BundleItem"("shopifyProductId");

-- CreateIndex
CREATE INDEX "BundleItem_categoryId_idx" ON "BundleItem"("categoryId");

-- CreateIndex
CREATE INDEX "BundleCategory_bundleId_idx" ON "BundleCategory"("bundleId");

-- CreateIndex
CREATE INDEX "BundleTier_bundleId_idx" ON "BundleTier"("bundleId");

-- CreateIndex
CREATE INDEX "VolumeRule_bundleId_idx" ON "VolumeRule"("bundleId");

-- CreateIndex
CREATE INDEX "BundleAnalytics_bundleId_idx" ON "BundleAnalytics"("bundleId");

-- CreateIndex
CREATE INDEX "BundleAnalytics_date_idx" ON "BundleAnalytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BundleAnalytics_bundleId_date_key" ON "BundleAnalytics"("bundleId", "date");

-- CreateIndex
CREATE INDEX "BundlePurchase_bundleId_idx" ON "BundlePurchase"("bundleId");

-- CreateIndex
CREATE INDEX "BundlePurchase_shop_idx" ON "BundlePurchase"("shop");

-- CreateIndex
CREATE INDEX "BundlePurchase_purchasedAt_idx" ON "BundlePurchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "BundleInventorySnapshot_bundleId_idx" ON "BundleInventorySnapshot"("bundleId");

-- CreateIndex
CREATE INDEX "BundleInventorySnapshot_checkedAt_idx" ON "BundleInventorySnapshot"("checkedAt");
