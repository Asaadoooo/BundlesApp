# Bundle App Extension - Complete Deployment Guide

This guide will walk you through deploying your Bundle App extension to your Shopify store.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Installation Steps](#installation-steps)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: Version 20.19+ or 22.12+
- **npm**: Version 9+ (comes with Node.js)
- **Shopify CLI**: Latest version
- **Git**: For version control

### Install Shopify CLI

```bash
npm install -g @shopify/cli @shopify/app
```

### Shopify Requirements

- Shopify Partner account
- Development store or access to production store
- Bundle app already installed and configured

---

## Project Structure

Your extension is located at:

```
bundle-app-test-at/
├── app/                          # Main bundle app
│   ├── routes/
│   │   └── api.storefront.bundle.by-product.$productId.tsx  # NEW API ROUTE
│   └── utils/
│       └── bundle.server.ts      # UPDATED with formatBundleForStorefront
└── extensions/
    └── bundle-product-ui/        # NEW EXTENSION
        ├── shopify.ui.extension.toml
        ├── package.json
        ├── tsconfig.json
        ├── README.md
        ├── locales/
        │   ├── en.default.json
        │   └── nl.json
        └── src/
            ├── index.tsx
            ├── types.ts
            ├── styles.ts
            ├── components/
            │   ├── ProductBundleDisplay.tsx
            │   └── BundleCartItem.tsx
            └── utils/
                └── api.ts
```

---

## Installation Steps

### Step 1: Install Extension Dependencies

Navigate to the extension directory:

```bash
cd extensions/bundle-product-ui
npm install
```

### Step 2: Update Main App Configuration

Add the extension configuration to your main `shopify.app.toml`:

```toml
# Add this section if not already present
[[extensions]]
type = "ui_extension"
handle = "bundle-product-ui"
```

### Step 3: Configure Environment Variables

Ensure your `.env` file has:

```env
# Your app URL (used by extension to fetch bundle data)
SHOPIFY_APP_URL=https://your-app-url.com

# Shopify API credentials
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,write_products,read_inventory,read_orders
```

### Step 4: Update Database (if needed)

If you modified the Prisma schema:

```bash
npx prisma generate
npx prisma migrate dev --name add_bundle_extensions
```

---

## Configuration

### Extension Settings

The extension can be configured in the theme editor with these settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `display_mode` | string | "auto" | How to display bundles |
| `show_individual_prices` | boolean | true | Show individual product prices |
| `show_savings_badge` | boolean | true | Display savings badge |
| `enable_stock_indicators` | boolean | false | Show stock availability |
| `primary_color` | color | #000000 | Primary color for UI elements |
| `position` | string | "above_atc" | Where to place bundle display |

### API Route Configuration

The new API route is automatically available at:

```
https://your-app-url.com/api/storefront/bundle/by-product/:productId
```

This route:
- ✅ Is publicly accessible (no auth required)
- ✅ Returns bundle data for storefront
- ✅ Tracks analytics (views)
- ✅ Validates bundle status and dates
- ✅ Handles CORS for cross-origin requests

---

## Testing

### Local Development Testing

1. **Start Development Server**

```bash
# From main app directory
npm run dev
```

2. **Test Extension Locally**

```bash
# In another terminal
cd extensions/bundle-product-ui
shopify app dev
```

3. **Access Development Store**

The CLI will provide a URL to your development store with the extension loaded.

### Testing Checklist

- [ ] Extension loads on product pages
- [ ] Bundle data fetches correctly
- [ ] Pricing displays accurately
- [ ] Savings calculations are correct
- [ ] Add to cart functionality works
- [ ] Cart shows grouped bundle items
- [ ] Stock indicators work (if enabled)
- [ ] Mobile responsive design
- [ ] Settings apply correctly in theme editor
- [ ] Multi-language support works

### Test Bundle Creation

Create a test bundle:

1. Go to your app admin (`/app/bundles/new/fixed`)
2. Create a Fixed Bundle:
   - Title: "Test Bundle"
   - Add 2-3 products
   - Set discount (e.g., 10% off)
   - Link to a product (shopifyProductId)
   - Set status to "ACTIVE"
3. Save and test on storefront

---

## Deployment

### Option 1: Deploy Everything Together

Deploy the entire app including extension:

```bash
# From main app directory
npm run deploy
```

Follow the prompts to:
1. Select your app
2. Choose deployment target (development/production)
3. Confirm deployment

### Option 2: Deploy Extension Only

Deploy just the extension:

```bash
cd extensions/bundle-product-ui
shopify app deploy
```

### Option 3: CI/CD Deployment

For automated deployments, add to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Deploy Shopify Extension
  run: |
    cd extensions/bundle-product-ui
    npm install
    shopify app deploy --no-update
  env:
    SHOPIFY_CLI_PARTNERS_TOKEN: ${{ secrets.SHOPIFY_CLI_TOKEN }}
```

### Deployment Verification

After deployment, verify:

```bash
# List deployed extensions
shopify app extensions list

# Check extension status
shopify app extension info bundle-product-ui
```

---

## Post-Deployment

### Step 1: Enable Extension in Theme

1. Go to Shopify Admin
2. Navigate to **Online Store > Themes**
3. Click **Customize** on your active theme
4. In the theme editor sidebar, click **App embeds**
5. Find **Bundle Product Display** and toggle it ON
6. Click **Save**

### Step 2: Configure Extension Settings

1. In theme editor, click on **Bundle Product Display** in app embeds
2. Configure settings:
   - Display mode
   - Show individual prices
   - Enable savings badge
   - Stock indicators
   - Primary color
3. Save changes

### Step 3: Add to Product Pages (Optional Manual Placement)

For specific placement on product pages:

1. In theme editor, go to **Products > Default product**
2. Click **Add block** in the section where you want the bundle
3. Select **Apps > Bundle Product Display**
4. Drag to desired position
5. Save

### Step 4: Test in Production

1. Create or edit a bundle in your app admin
2. Link it to a product (set `shopifyProductId`)
3. Set status to "ACTIVE"
4. Visit the product page on your store
5. Verify bundle displays correctly
6. Test add to cart
7. Check cart page for bundle grouping

---

## Troubleshooting

### Extension Not Appearing

**Problem**: Extension doesn't show on product pages

**Solutions**:
1. Check extension is enabled in theme editor (App embeds)
2. Verify bundle exists and is ACTIVE for the product
3. Check bundle date range (startDate/endDate)
4. Ensure `shopifyProductId` matches the product
5. Check browser console for errors

### API Errors

**Problem**: "Failed to fetch bundle data"

**Solutions**:
1. Verify `SHOPIFY_APP_URL` environment variable is set correctly
2. Check API route is deployed: `curl https://your-app-url.com/api/storefront/bundle/by-product/gid://shopify/Product/123`
3. Check CORS headers in API response
4. Verify database connection
5. Check app logs for errors

### Pricing Issues

**Problem**: Bundle pricing incorrect or not displaying

**Solutions**:
1. Verify discount configuration in bundle admin
2. Check `calculateBundlePricing` function in `bundle.server.ts`
3. Ensure product prices are synced from Shopify
4. Test pricing calculation endpoint
5. Check for null/undefined values

### Cart Not Grouping Items

**Problem**: Bundle items show separately in cart

**Solutions**:
1. Verify bundle metadata added to cart items:
   - `_bundleId`
   - `_bundleTitle`
   - `_bundleSavings`
2. Check `BundleCartItem` component is rendering
3. Verify cart line items have attributes
4. Check theme compatibility

### Build Errors

**Problem**: Extension fails to build

**Solutions**:
1. Check Node.js version (20.19+ or 22.12+)
2. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Check TypeScript errors:
   ```bash
   npm run build
   ```
4. Verify all dependencies are installed

### Theme Conflicts

**Problem**: Extension conflicts with theme

**Solutions**:
1. Check theme JavaScript for conflicts
2. Disable other bundle/product apps temporarily
3. Test on a default Shopify theme (Dawn)
4. Check CSS specificity issues
5. Review browser console for errors

---

## Monitoring & Maintenance

### Analytics Tracking

The extension automatically tracks:
- Bundle views (incremented on page load)
- Add-to-cart events (tracked via API)
- Purchase conversions (via webhooks)

View analytics at: `/app/analytics`

### Performance Monitoring

Monitor these metrics:
- API response times
- Extension load times
- Error rates
- Conversion rates

### Regular Maintenance

**Weekly**:
- Check error logs
- Review analytics
- Test key user flows

**Monthly**:
- Update dependencies
- Review performance metrics
- Gather merchant feedback

**Quarterly**:
- Major feature updates
- Security patches
- Shopify API version updates

---

## Updating the Extension

### Minor Updates

For bug fixes or small changes:

```bash
cd extensions/bundle-product-ui
# Make changes
npm run build
shopify app deploy
```

### Major Updates

For significant changes:

1. Test thoroughly in development
2. Create a new version
3. Deploy to development store first
4. Test with real data
5. Deploy to production

### Version Management

Update version in `package.json`:

```json
{
  "version": "1.1.0"
}
```

Document changes in `CHANGELOG.md`

---

## Support Resources

- **Shopify UI Extensions Docs**: https://shopify.dev/docs/api/checkout-ui-extensions
- **Shopify CLI Docs**: https://shopify.dev/docs/api/shopify-cli
- **Bundle App Admin**: `/app`
- **Analytics Dashboard**: `/app/analytics`

---

## Next Steps

### Expand Functionality

1. **Add Mix & Match Support**
   - Update `ProductBundleDisplay` component
   - Add product selection UI
   - Implement category-based selection

2. **Add Volume Bundles**
   - Real-time quantity-based discounts
   - Tiered pricing display
   - Quantity selector UI

3. **Add Tiered Bundles**
   - Tier comparison UI (Bronze/Silver/Gold)
   - Tier switching functionality
   - Feature comparison table

4. **Enhanced Features**
   - Bundle reviews/ratings
   - Social sharing
   - Gift message options
   - Seasonal campaign support
   - A/B testing capabilities

---

## Success Checklist

Before marking deployment as complete:

- [ ] Extension deployed to production
- [ ] Enabled in theme editor
- [ ] Test bundle created and verified
- [ ] Product page display working
- [ ] Cart grouping functional
- [ ] Pricing calculations correct
- [ ] Mobile responsive
- [ ] Analytics tracking working
- [ ] Error handling tested
- [ ] Documentation reviewed
- [ ] Team trained on usage
- [ ] Monitoring set up

---

**Congratulations! Your Bundle App extension is now live on your Shopify store!** 🎉

For questions or issues, refer to the troubleshooting section or review the component README files in `extensions/bundle-product-ui/`.
