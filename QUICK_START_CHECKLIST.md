# Bundle Extension - Quick Start Checklist

Follow this checklist to get your bundle extension up and running.

---

## ✅ Pre-Deployment (15 minutes)

### 1. Install Extension Dependencies

```bash
cd extensions/bundle-product-ui
npm install
cd ../..
```

**Verify:** No error messages, `node_modules` folder created

---

### 2. Configure Environment

Edit your `.env` file and ensure these variables are set:

```env
SHOPIFY_APP_URL=https://your-actual-app-url.com
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
```

**Verify:** File saved with correct values (no "example.com")

---

### 3. Test API Route Locally

```bash
# Start your dev server
npm run dev
```

Visit: `http://localhost:3000/api/storefront/bundle/by-product/test`

**Verify:** Should return JSON (404 is OK for now)

---

## ✅ Create Test Bundle (10 minutes)

### 4. Create a Fixed Bundle

1. Go to `/app/bundles/new/fixed`
2. Fill in:
   - **Title:** "Test Bundle - Summer Collection"
   - **Description:** "Save 15% on summer essentials"
   - **Add 2-3 products** from your store
   - **Set discount:** 15% off
   - **Status:** Set to "ACTIVE"
3. Click "Save"

**Verify:** Bundle appears in `/app/bundles` list

---

### 5. Link Bundle to Product

1. Edit the bundle you just created
2. Find "Shopify Product ID" field
3. Enter a product ID from your store (format: `gid://shopify/Product/1234567890`)
   - Or use the product picker if available
4. Save

**Verify:** Product ID saved correctly

---

## ✅ Deploy Extension (15 minutes)

### 6. Build Extension

```bash
cd extensions/bundle-product-ui
npm run build
```

**Verify:** Build completes without errors

---

### 7. Deploy to Shopify

From the main app directory:

```bash
npm run deploy
```

Or deploy extension only:

```bash
cd extensions/bundle-product-ui
shopify app deploy
```

Follow the CLI prompts:
- Select your app
- Choose environment (development or production)
- Confirm deployment

**Verify:** CLI shows "Extension deployed successfully"

---

### 8. Check Deployment Status

```bash
shopify app extensions list
```

**Verify:** "bundle-product-ui" appears in the list with "deployed" status

---

## ✅ Activate in Theme (5 minutes)

### 9. Enable App Embed

1. Go to Shopify Admin
2. Navigate to **Online Store** > **Themes**
3. Click **Customize** on your active theme
4. In left sidebar, scroll to bottom and click **App embeds**
5. Find **"Bundle Product Display"**
6. Toggle switch to **ON** (enabled)
7. Click **Save** in top right

**Verify:** Toggle is ON and changes saved

---

### 10. Configure Settings

Still in the theme editor:

1. Click on **"Bundle Product Display"** (now enabled)
2. Configure options:
   - ✅ Show individual prices: ON
   - ✅ Show savings badge: ON
   - ⚪ Enable stock indicators: OFF (for now)
   - **Primary color:** Choose your brand color
3. Click **Save**

**Verify:** Settings saved successfully

---

## ✅ Test on Storefront (10 minutes)

### 11. Visit Product Page

1. Find the product you linked to your bundle (step 5)
2. Visit that product's page on your storefront
3. Look for the bundle display

**Verify:** Bundle section appears on the page showing:
- ✅ Bundle title
- ✅ Bundle description
- ✅ List of included products
- ✅ Bundle price
- ✅ Savings badge
- ✅ "Add Bundle to Cart" button

---

### 12. Test Add to Cart

1. Click **"Add Bundle to Cart"** button
2. Wait for confirmation (redirect to cart)

**Verify:**
- ✅ Redirected to cart page
- ✅ Bundle items appear in cart
- ✅ Bundle badge/indicator visible
- ✅ Savings displayed

---

### 13. Test Cart Behavior

In the cart:

1. Try to remove individual bundle items
2. Check if bundle is grouped together
3. Verify pricing is correct

**Verify:**
- ✅ Bundle items grouped (or badged)
- ✅ Total price correct
- ✅ Savings displayed

---

### 14. Test Mobile View

1. Open product page on mobile device or use browser dev tools
2. Resize to mobile width
3. Check bundle display

**Verify:**
- ✅ Layout responsive
- ✅ Text readable
- ✅ Images display correctly
- ✅ Button accessible

---

## ✅ Check Analytics (2 minutes)

### 15. Verify Tracking

1. Go to `/app/analytics` in your bundle app admin
2. Look for today's data
3. Check if bundle views are being tracked

**Verify:**
- ✅ Bundle appears in analytics
- ✅ View count > 0
- ✅ Date is today

---

## ✅ Production Checklist (5 minutes)

### 16. Final Verification

Before marking complete, verify:

- [ ] Extension deployed to production (not just dev)
- [ ] Extension enabled in theme
- [ ] At least one active bundle created
- [ ] Bundle displays on product page
- [ ] Add to cart works
- [ ] Cart shows bundle correctly
- [ ] Pricing calculates accurately
- [ ] Mobile view works
- [ ] Analytics tracking active
- [ ] No console errors in browser
- [ ] Settings applied correctly

---

## 🎉 Success!

If all checkboxes are marked, your Bundle Extension is live and working!

---

## 🚨 Troubleshooting Quick Fixes

### Bundle Not Showing on Product Page

**Check:**
1. Bundle status is "ACTIVE" (not draft)
2. Product ID is correct in bundle settings
3. Extension is enabled in theme (App embeds)
4. No start/end date issues
5. Check browser console for errors

**Quick fix:**
```bash
# Check API route
curl https://your-app-url.com/api/storefront/bundle/by-product/YOUR_PRODUCT_ID
```

---

### Add to Cart Not Working

**Check:**
1. Browser console for errors
2. Network tab for failed API calls
3. Product variants are available
4. Cart page accessible

**Quick fix:**
- Try on a different product
- Clear browser cache
- Test in incognito mode

---

### Styling Issues

**Check:**
1. Theme compatibility
2. Other apps conflicting
3. CSS loading correctly

**Quick fix:**
- Test on default Shopify theme (Dawn)
- Disable other product apps temporarily
- Check theme editor settings

---

## 📞 Need Help?

**Documentation:**
- [EXTENSION_SUMMARY.md](EXTENSION_SUMMARY.md:1) - Overview
- [EXTENSION_DEPLOYMENT_GUIDE.md](EXTENSION_DEPLOYMENT_GUIDE.md:1) - Detailed guide
- [extensions/bundle-product-ui/README.md](extensions/bundle-product-ui/README.md:1) - Technical docs

**Common Issues:**
- Review troubleshooting section in deployment guide
- Check Shopify CLI documentation
- Verify API route is accessible

---

## 🔄 Next Steps After Completion

1. **Create More Bundles**
   - Seasonal bundles
   - Product category bundles
   - Best-seller combinations

2. **Optimize Settings**
   - Test different display modes
   - A/B test positioning
   - Adjust colors/styling

3. **Monitor Performance**
   - Check analytics daily
   - Track conversion rates
   - Gather customer feedback

4. **Expand Functionality**
   - Add Mix & Match bundles
   - Implement Volume discounts
   - Create Tiered bundles

---

**Estimated Total Time:** 60-70 minutes from start to finish

**Status:** Your bundle app is now fully integrated into your storefront! 🎊
