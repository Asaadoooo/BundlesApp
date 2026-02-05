# App Proxy Setup Guide

## What is App Proxy?

App Proxy allows your extension to make API calls from the storefront (customer's browser) to your app backend **through Shopify**, avoiding CORS issues and security restrictions.

## How It Works

```
Customer Browser
    ↓
https://yourstore.myshopify.com/apps/bundles/api/...
    ↓
Shopify App Proxy (automatic)
    ↓
https://your-app-url.com/apps/bundles/api/...
    ↓
Your App Backend
```

## Configuration

### 1. App Proxy Config ([shopify.app.toml](shopify.app.toml:30))

```toml
[app_proxy]
url = "/apps/bundles"
subpath = "bundles"
prefix = "apps"
```

This creates the proxy path: `/apps/bundles/*`

### 2. Extension API Calls ([api.ts](extensions/bundle-product-ui/src/utils/api.ts:7))

```typescript
// Uses relative URL - goes through store's domain
const API_BASE_URL = '/apps/bundles';

// Fetches from: yourstore.com/apps/bundles/api/storefront/bundle/by-product/123
fetch(`${API_BASE_URL}/api/storefront/bundle/by-product/${productId}`)
```

### 3. App Route ([apps.bundles.api.storefront.bundle.by-product.$productId.tsx](app/routes/apps.bundles.api.storefront.bundle.by-product.$productId.tsx:1))

The route file path matches the proxy URL:
- URL: `/apps/bundles/api/storefront/bundle/by-product/:productId`
- File: `app/routes/apps.bundles.api.storefront.bundle.by-product.$productId.tsx`

## Development Setup

### No Environment Variable Needed!

With App Proxy, you **don't need** `SHOPIFY_APP_URL` in `.env` for the extension to work.

### Testing Locally

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Access via development store:**
   The Shopify CLI automatically sets up the proxy for your dev store.

3. **Test the proxy:**
   Visit: `https://your-dev-store.myshopify.com/apps/bundles/api/storefront/bundle/by-product/test`

   Should return JSON (404 is OK if no bundle exists)

## URL Structure

| What | URL |
|------|-----|
| **Storefront request** | `yourstore.com/apps/bundles/api/storefront/bundle/by-product/123` |
| **Proxied to** | `your-app.com/apps/bundles/api/storefront/bundle/by-product/123` |
| **Route file** | `app/routes/apps.bundles.api.storefront.bundle.by-product.$productId.tsx` |
| **React Router route** | `/apps/bundles/api/storefront/bundle/by-product/:productId` |

## Benefits of App Proxy

✅ **No CORS issues** - Requests go through Shopify
✅ **No environment variables needed** - Uses relative URLs
✅ **Secure** - Shopify handles authentication/validation
✅ **Works in production** - Automatic proxy setup
✅ **Same domain** - No cross-origin restrictions

## Common Routes

Create these proxy routes for all extension API calls:

1. **Get bundle by product:**
   - File: `apps.bundles.api.storefront.bundle.by-product.$productId.tsx`
   - URL: `/apps/bundles/api/storefront/bundle/by-product/:productId`

2. **Get bundle by ID:**
   - File: `apps.bundles.api.storefront.bundle.$id.tsx`
   - URL: `/apps/bundles/api/storefront/bundle/:id`

3. **Add to cart:**
   - File: `apps.bundles.api.storefront.bundle.add-to-cart.tsx`
   - URL: `/apps/bundles/api/storefront/bundle/add-to-cart`

4. **Validate selection:**
   - File: `apps.bundles.api.storefront.bundle.validate.tsx`
   - URL: `/apps/bundles/api/storefront/bundle/validate`

5. **Check inventory:**
   - File: `apps.bundles.api.inventory.check.tsx`
   - URL: `/apps/bundles/api/inventory/check`

## Deployment

### Development
- Shopify CLI automatically configures proxy
- No additional setup needed

### Production
1. Deploy your app: `npm run deploy`
2. Shopify automatically sets up the proxy based on `shopify.app.toml`
3. Extension will work immediately

## Testing

### Verify Proxy is Working

1. **In development:**
   ```bash
   # Should return JSON
   curl https://your-dev-store.myshopify.com/apps/bundles/api/storefront/bundle/by-product/test
   ```

2. **Check headers:**
   ```bash
   curl -I https://your-dev-store.myshopify.com/apps/bundles/api/storefront/bundle/by-product/test
   ```

   Should see CORS headers and proper status code.

3. **From browser:**
   Open your product page and check Network tab for `/apps/bundles/` requests.

## Troubleshooting

### 404 on Proxy Route

**Problem:** `/apps/bundles/...` returns 404

**Solutions:**
- Check `shopify.app.toml` has `[app_proxy]` section
- Verify route file path matches URL structure
- Restart dev server: `npm run dev`
- Check route file is in `app/routes/` directory

### CORS Errors

**Problem:** CORS error in browser console

**Solutions:**
- Make sure you're using relative URL (`/apps/bundles/...`)
- Don't use absolute URLs (`https://...`)
- Check CORS headers in route response
- Use App Proxy routes, not direct API routes

### Extension Can't Reach API

**Problem:** Extension shows "Failed to load bundle"

**Solutions:**
- Check Network tab in browser DevTools
- Verify proxy route returns data
- Check API route has CORS headers
- Test proxy route directly in browser

## Migration from Direct API

If you have existing code using direct API calls:

**Before:**
```typescript
const API_BASE_URL = process.env.SHOPIFY_APP_URL || '';
fetch(`${API_BASE_URL}/api/storefront/bundle/${id}`)
```

**After:**
```typescript
const API_BASE_URL = '/apps/bundles';
fetch(`${API_BASE_URL}/api/storefront/bundle/${id}`)
```

## Summary

✅ **App Proxy configured** in `shopify.app.toml`
✅ **Proxy routes created** in `app/routes/apps.bundles.*`
✅ **Extension updated** to use relative URLs
✅ **No environment variables needed** for extension
✅ **Works in development and production**

**You're ready to test the extension!**
