/**
 * Quick fix: Link bundle to product
 * Run with: node fix-bundle-link.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkBundle() {
  const bundleHandle = 'asaad-1770277237519'; // Your bundle handle
  const productId = '8984540053667'; // The product ID from the URL

  try {
    const bundle = await prisma.bundle.findFirst({
      where: { handle: bundleHandle }
    });

    if (!bundle) {
      console.error('❌ Bundle not found with handle:', bundleHandle);
      return;
    }

    console.log('📦 Found bundle:', bundle.title);

    const updated = await prisma.bundle.update({
      where: { id: bundle.id },
      data: { shopifyProductId: productId }
    });

    console.log('✅ Bundle linked to product!');
    console.log('   Bundle:', updated.title);
    console.log('   Product ID:', updated.shopifyProductId);
    console.log('\n🎉 Now refresh your product page - the bundle should appear!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkBundle();
