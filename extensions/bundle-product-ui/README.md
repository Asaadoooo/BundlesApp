# Bundle Storefront Extension

This Shopify Theme App Extension provides customer-facing bundle functionality for your store. It displays bundles on product pages and groups them in the cart.

## Features

- 🎁 **Product Page Display**: Shows bundle information with pricing and savings on product detail pages
- 🛒 **Cart Grouping**: Groups bundle items together in cart as a single unit
- 💰 **Real-time Pricing**: Calculates and displays bundle pricing with savings
- 📦 **Inventory Tracking**: Shows stock availability for bundles
- 🎨 **Customizable**: Merchant-configurable display settings
- 🌍 **Multi-language**: Supports English and Dutch (extensible)
- 📱 **Responsive**: Mobile-friendly design

## Architecture

### Components

1. **ProductBundleDisplay** (`src/components/ProductBundleDisplay.tsx`)
   - Displays bundle information on product pages
   - Fetches bundle data from your app's API
   - Shows bundle items, pricing, savings, and stock status
   - Handles add-to-cart functionality

2. **BundleCartItem** (`src/components/BundleCartItem.tsx`)
   - Displays bundles as grouped items in cart
   - Shows expandable bundle contents
   - Prevents individual item removal
   - Displays savings and bundle pricing

### API Integration

The extension communicates with your bundle app through these API endpoints:

- `GET /api/storefront/bundle/by-product/:productId` - Fetch bundle for a product
- `GET /api/storefront/bundle/:bundleId` - Fetch bundle by ID
- `POST /api/storefront/bundle/add-to-cart` - Add bundle to cart
- `POST /api/storefront/bundle/validate` - Validate bundle selection
- `POST /api/inventory/check` - Check bundle inventory
- `POST /api/pricing/calculate` - Calculate bundle pricing

## Installation & Deployment

### Prerequisites

- Shopify CLI installed (`npm install -g @shopify/cli @shopify/app`)
- Node.js 20.19+ or 22.12+
- Active Shopify development store or partner account
- Bundle app already deployed

### Step 1: Install Dependencies

```bash
cd extensions/bundle-product-ui
npm install
```

### Step 2: Configure Environment

Make sure your main app's `.env` file has:

```env
SHOPIFY_APP_URL=https://your-app-url.com
```

This URL is used by the extension to fetch bundle data.

### Step 3: Build Extension

```bash
npm run build
```

### Step 4: Deploy Extension

From your main app directory:

```bash
npm run deploy
```

Or deploy just the extension:

```bash
cd extensions/bundle-product-ui
shopify app deploy
```

### Step 5: Activate Extension in Theme

1. Go to your Shopify admin
2. Navigate to **Online Store > Themes**
3. Click **Customize** on your active theme
4. Click **App embeds** in the left sidebar
5. Enable **Bundle Product Display**
6. Configure settings as needed
7. Save your changes

### Step 6: Add to Product Pages (Optional)

For manual placement:

1. In the theme editor, navigate to a product page
2. Click **Add block** in the desired section
3. Select **Apps > Bundle Product Display**
4. Position the block where you want it
5. Save

The extension also supports automatic injection near the Add to Cart button if no manual block is placed.

## Configuration

### Extension Settings

Merchants can configure these settings in the theme editor:

| Setting | Description | Default |
|---------|-------------|---------|
| Display Mode | How to display bundles (auto/above_atc/below_description/modal) | auto |
| Show Individual Prices | Display prices of individual products | true |
| Show Savings Badge | Display "You save €X" badge | true |
| Enable Stock Indicators | Show inventory availability | false |
| Primary Color | Color for buttons and highlights | #000000 |
| Position | Where to place the bundle display | above_atc |

## How It Works

### Bundle Detection

1. Extension loads on product page
2. Fetches bundle data using product ID from API
3. Checks if bundle is active and within date range
4. Validates inventory if stock indicators are enabled
5. Displays bundle UI if all checks pass

### Cart Behavior

1. When bundle is added to cart, each item includes metadata:
   - `_bundleId`: Bundle identifier
   - `_bundleTitle`: Bundle name
   - `_bundleSavings`: Amount saved
2. Cart component detects items with bundle metadata
3. Groups them together as a single unit
4. Displays bundle summary with expandable details
5. Prevents individual item removal

### Pricing Logic

- Fetches real-time pricing from bundle app API
- Calculates savings based on discount rules
- Displays original price (crossed out) and bundle price
- Shows percentage and amount saved
- Updates when bundle configuration changes

## Customization

### Styling

To customize the appearance, edit the component styles in:
- `src/components/ProductBundleDisplay.tsx`
- `src/components/BundleCartItem.tsx`

Shopify UI Extensions use the Shopify design system, so most styling is handled through component props.

### Adding Languages

1. Create new locale file: `locales/[language-code].json`
2. Copy structure from `en.default.json`
3. Translate all strings
4. Rebuild extension

### Supporting More Bundle Types

Currently supports Fixed Bundles. To add Mix & Match, Volume, or Tiered bundles:

1. Update `ProductBundleDisplay.tsx` to handle new bundle types
2. Add UI components for product selection (Mix & Match)
3. Add tier selection UI (Tiered)
4. Update pricing calculation logic
5. Test thoroughly

## Testing

### Local Testing

1. Start your dev environment:
   ```bash
   npm run dev
   ```

2. Open development store
3. Navigate to product with a bundle
4. Verify bundle display and functionality

### Test Checklist

- [ ] Bundle displays on correct products
- [ ] Pricing calculates correctly
- [ ] Stock indicators show accurate data
- [ ] Add to cart works
- [ ] Cart shows grouped bundle items
- [ ] Bundle items cannot be individually removed
- [ ] Savings display correctly
- [ ] Mobile responsive
- [ ] Works with theme customizer
- [ ] Settings apply correctly

## Troubleshooting

### Bundle Not Showing

**Check:**
- Bundle status is "ACTIVE"
- Bundle is within date range (startDate/endDate)
- Product ID matches bundle's shopifyProductId
- API endpoint is accessible
- Extension is enabled in theme

### Pricing Incorrect

**Check:**
- Discount rules configured correctly
- Product prices are current
- API returns correct pricing data
- Compare-at prices set correctly

### Cart Issues

**Check:**
- Bundle metadata added to cart items
- Cart attributes include `_bundleId`
- Extension enabled in cart
- No theme conflicts

### API Errors

**Check:**
- SHOPIFY_APP_URL environment variable set
- App API routes deployed
- CORS headers configured
- Network connectivity

## Performance

### Optimization Tips

1. **Enable Caching**: Cache bundle data on storefront
2. **Lazy Loading**: Load bundle data only when needed
3. **Image Optimization**: Use optimized product images
4. **Minimize API Calls**: Fetch only necessary data
5. **Use CDN**: Serve static assets via CDN

### Monitoring

Track these metrics:
- Bundle view rate
- Add-to-cart conversion
- Cart abandonment for bundles
- API response times
- Error rates

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Shopify UI Extensions documentation
3. Check bundle app API logs
4. Contact developer

## License

Proprietary - Part of Bundle App

## Changelog

### Version 1.0.0 (2026-02-05)
- Initial release
- Support for Fixed Bundles
- Product page display
- Cart grouping
- Multi-language support (EN/NL)
- Stock indicators
- Savings display
- Responsive design
