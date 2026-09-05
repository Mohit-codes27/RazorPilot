/**
 * RazorPilot demo marketplace seed.
 * Idempotent: safe to run multiple times (upserts + skip-if-exists).
 *
 * Usage: npm run seed
 */
import { prisma } from '../src/db/prisma.js';
import { USER_STATUS } from '../src/config/constants.js';
import { hashPassword } from '../src/security/password.js';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'DemoPass123';
const DEMO_MERCHANT_PASSWORD = 'MerchantPass123';

interface SeedProduct {
  name: string;
  price: number;
  stock: number;
  merchant: number;
  description: string;
  attributes: Record<string, unknown>;
  status?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  // ---- merchants ----
  const merchantDefs = [
    { name: 'TechBazaar', email: 'techbazaar@example.com' },
    { name: 'SoundScape', email: 'soundscape@example.com' },
    { name: 'ComputeHub', email: 'computehub@example.com' },
  ];
  const merchants = [];
  const merchantHash = await hashPassword(DEMO_MERCHANT_PASSWORD);
  for (const m of merchantDefs) {
    merchants.push(
      await prisma.merchant.upsert({
        where: { email: m.email },
        update: { name: m.name, status: 'ACTIVE', passwordHash: merchantHash },
        create: { name: m.name, email: m.email, status: 'ACTIVE', passwordHash: merchantHash },
      }),
    );
  }

  // ---- categories ----
  const categoryDefs = [
    { name: 'Headphones', slug: 'headphones' },
    { name: 'Keyboards', slug: 'keyboards' },
    { name: 'Mice', slug: 'mice' },
    { name: 'Monitors', slug: 'monitors' },
    { name: 'Accessories', slug: 'accessories' },
  ];
  const categories: Record<string, { id: string }> = {};
  for (const c of categoryDefs) {
    categories[c.slug] = await prisma.productCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    });
  }

  // ---- products ----
  const catalog: Record<string, SeedProduct[]> = {
    headphones: [
      { name: 'JBL Tune 770NC', price: 4999, stock: 25, merchant: 1, description: 'Adaptive noise-cancelling wireless over-ear headphones with 70-hour battery.', attributes: { wireless: true, noise_cancellation: true, battery_hours: 70, weight_grams: 232 } },
      { name: 'Sony WH-CH520', price: 4490, stock: 30, merchant: 1, description: 'Lightweight wireless on-ear headphones with 50-hour battery and multipoint.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 50, weight_grams: 147 } },
      { name: 'boAt Rockerz 550', price: 1999, stock: 60, merchant: 0, description: 'Budget wireless over-ear headphones with 20-hour playback and 50mm drivers.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 20, weight_grams: 250 } },
      { name: 'Noise Two Wireless', price: 1499, stock: 45, merchant: 0, description: 'Affordable wireless headphones tuned for study playlists and calls.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 50, weight_grams: 200 } },
      { name: 'Zebronics Zeb-Duke', price: 1299, stock: 80, merchant: 2, description: 'Entry-level wireless headphones with deep bass and voice assistant support.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 30, weight_grams: 210 } },
      { name: 'Sennheiser HD 350BT', price: 6990, stock: 12, merchant: 1, description: 'Audiophile-grade wireless on-ear headphones with aptX support.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 30, weight_grams: 238 } },
      { name: 'Anker Soundcore Q20i', price: 3999, stock: 22, merchant: 0, description: 'Hybrid noise-cancelling headphones with 40-hour battery and fast charging.', attributes: { wireless: true, noise_cancellation: true, battery_hours: 40, weight_grams: 245 } },
      { name: 'Philips TAH4205', price: 2999, stock: 0, merchant: 2, description: 'Bass-forward wireless on-ear headphones, currently restocking.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 55, weight_grams: 190 }, status: 'OUT_OF_STOCK' },
      { name: 'Skullcandy Hesh Evo', price: 7999, stock: 8, merchant: 1, description: 'Premium wireless headphones with Tile finding and 36-hour battery.', attributes: { wireless: true, noise_cancellation: false, battery_hours: 36, weight_grams: 228 } },
      { name: 'Cosmic Byte Europa (Wired)', price: 1599, stock: 40, merchant: 2, description: 'Wired gaming headphones with mic for study breaks and play.', attributes: { wireless: false, noise_cancellation: false, weight_grams: 300 } },
      { name: 'Discontinued Demo Pair', price: 999, stock: 5, merchant: 0, description: 'Hidden legacy product for storefront filtering tests.', attributes: {}, status: 'INACTIVE' },
    ],
    keyboards: [
      { name: 'Logitech K380', price: 2499, stock: 50, merchant: 0, description: 'Compact multi-device Bluetooth keyboard, quiet keys for study rooms.', attributes: { wireless: true, layout: 'tenkeyless', rgb: false, switch_type: 'membrane' } },
      { name: 'Keychron K2 V2', price: 7499, stock: 15, merchant: 0, description: 'Wireless mechanical keyboard with hot-swappable Gateron switches.', attributes: { wireless: true, layout: '75_percent', rgb: true, switch_type: 'mechanical' } },
      { name: 'Zebronics Zeb-Max Ninja', price: 1899, stock: 55, merchant: 2, description: 'Backlit USB mechanical keyboard with aluminium body.', attributes: { wireless: false, layout: 'full', rgb: true, switch_type: 'mechanical' } },
      { name: 'Cosmic Byte CB-GK-16', price: 2199, stock: 38, merchant: 2, description: 'Mechanical gaming keyboard with blue switches and rainbow LEDs.', attributes: { wireless: false, layout: 'full', rgb: true, switch_type: 'mechanical' } },
      { name: 'HP K500F', price: 1299, stock: 70, merchant: 2, description: 'Reliable wired chiclet keyboard for everyday typing.', attributes: { wireless: false, layout: 'full', rgb: false, switch_type: 'membrane' } },
      { name: 'Dell KB216', price: 649, stock: 90, merchant: 2, description: 'Basic wired USB keyboard, spill-resistant.', attributes: { wireless: false, layout: 'full', rgb: false, switch_type: 'membrane' } },
      { name: 'Portronics Key6 Combo', price: 1499, stock: 42, merchant: 0, description: 'Wireless keyboard-mouse combo for clean desks.', attributes: { wireless: true, layout: 'full', rgb: false, switch_type: 'membrane' } },
      { name: 'Redragon K552 RGB', price: 3499, stock: 20, merchant: 2, description: 'Tenkeyless RGB mechanical keyboard for gaming setups.', attributes: { wireless: false, layout: 'tenkeyless', rgb: true, switch_type: 'mechanical' } },
      { name: 'Logitech MX Keys Mini', price: 9999, stock: 10, merchant: 0, description: 'Premium low-profile wireless keyboard with backlit smart keys.', attributes: { wireless: true, layout: 'tenkeyless', rgb: false, switch_type: 'scissor' } },
      { name: 'Amkette EvoFox', price: 999, stock: 65, merchant: 2, description: 'Budget membrane keyboard for students.', attributes: { wireless: false, layout: 'full', rgb: false, switch_type: 'membrane' } },
    ],
    mice: [
      { name: 'Logitech G304 Lightspeed', price: 2495, stock: 48, merchant: 0, description: 'Wireless gaming mouse with HERO sensor and 250-hour battery.', attributes: { wireless: true, dpi: 12000, buttons: 6, weight_grams: 99 } },
      { name: 'Logitech M331 Silent Plus', price: 1095, stock: 75, merchant: 0, description: 'Silent-click wireless mouse for libraries and dorms.', attributes: { wireless: true, dpi: 1000, buttons: 3, weight_grams: 91 } },
      { name: 'HP X3000 G3', price: 649, stock: 100, merchant: 2, description: 'Everyday wireless mouse with 15-month battery.', attributes: { wireless: true, dpi: 1200, buttons: 3, weight_grams: 80 } },
      { name: 'Dell MS116', price: 499, stock: 120, merchant: 2, description: 'Wired optical mouse, plug-and-play workhorse.', attributes: { wireless: false, dpi: 1000, buttons: 3, weight_grams: 85 } },
      { name: 'Zebronics Zeb-Transformer-M', price: 899, stock: 60, merchant: 2, description: 'Wired gaming mouse with 6 buttons and breathing LEDs.', attributes: { wireless: false, dpi: 3200, buttons: 6, weight_grams: 110 } },
      { name: 'Cosmic Byte Equinox', price: 1299, stock: 35, merchant: 2, description: 'RGB gaming mouse with adjustable DPI up to 6400.', attributes: { wireless: false, dpi: 6400, buttons: 7, weight_grams: 130 } },
      { name: 'Portronics Toad 23', price: 599, stock: 95, merchant: 0, description: 'Compact wireless mouse for travel and study.', attributes: { wireless: true, dpi: 1600, buttons: 3, weight_grams: 60 } },
      { name: 'Lenovo Legion M200', price: 1599, stock: 28, merchant: 2, description: 'Ambidextrous RGB gaming mouse with 5 DPI presets.', attributes: { wireless: false, dpi: 5000, buttons: 5, weight_grams: 120 } },
      { name: 'Redgear A-15', price: 749, stock: 52, merchant: 2, description: 'Wired gaming mouse with 6400 DPI sensor.', attributes: { wireless: false, dpi: 6400, buttons: 6, weight_grams: 125 } },
      { name: 'Apple Magic Mouse', price: 7490, stock: 0, merchant: 0, description: 'Multi-touch wireless mouse, currently out of stock.', attributes: { wireless: true, dpi: 1300, buttons: 1, weight_grams: 99 }, status: 'OUT_OF_STOCK' },
    ],
    monitors: [
      { name: 'LG 24MR400 24-inch 100Hz', price: 8999, stock: 18, merchant: 2, description: '24-inch Full HD IPS monitor with 100Hz refresh for study and media.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 100, panel: 'IPS' } },
      { name: 'Samsung LF24C310 24-inch Curved', price: 9499, stock: 14, merchant: 2, description: 'Curved 75Hz monitor with eye-saver mode.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 75, panel: 'VA' } },
      { name: 'Dell S2421HN 24-inch', price: 11999, stock: 11, merchant: 2, description: 'Ultrathin-bezel IPS monitor with AMD FreeSync.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 75, panel: 'IPS' } },
      { name: 'HP M22F 22-inch', price: 8499, stock: 20, merchant: 2, description: '22-inch IPS monitor with 3-sided micro-edge display.', attributes: { size_inch: 22, resolution: '1920x1080', refresh_hz: 75, panel: 'IPS' } },
      { name: 'Zebronics ZEB-MV124 24-inch', price: 6999, stock: 25, merchant: 2, description: 'Budget Full HD monitor for students.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 75, panel: 'VA' } },
      { name: 'BenQ GW2480 24-inch', price: 9999, stock: 13, merchant: 2, description: 'Eye-care IPS monitor with low blue light.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 60, panel: 'IPS' } },
      { name: 'Acer EK220Q 22-inch', price: 7499, stock: 22, merchant: 2, description: 'Affordable 100Hz Full HD monitor.', attributes: { size_inch: 22, resolution: '1920x1080', refresh_hz: 100, panel: 'VA' } },
      { name: 'LG 27MP400 27-inch', price: 13499, stock: 9, merchant: 2, description: '27-inch Full HD IPS monitor for multitasking.', attributes: { size_inch: 27, resolution: '1920x1080', refresh_hz: 75, panel: 'IPS' } },
      { name: 'ViewSonic VA2215 22-inch', price: 7999, stock: 16, merchant: 2, description: 'Flicker-free 100Hz monitor with ViewMode presets.', attributes: { size_inch: 22, resolution: '1920x1080', refresh_hz: 100, panel: 'VA' } },
      { name: 'Gigabyte GS24F 24-inch 165Hz', price: 12999, stock: 7, merchant: 2, description: '165Hz IPS gaming monitor with 1ms response.', attributes: { size_inch: 24, resolution: '1920x1080', refresh_hz: 165, panel: 'IPS' } },
    ],
    accessories: [
      { name: 'USB-C 65W Fast-Charge Cable 1.5m', price: 499, stock: 150, merchant: 0, description: 'Braided nylon USB-C cable with 65W PD support.', attributes: { length_m: 1.5, power_w: 65 } },
      { name: 'Aluminium Laptop Stand', price: 1299, stock: 55, merchant: 0, description: 'Foldable ergonomic laptop stand for desks.', attributes: { material: 'aluminium', foldable: true } },
      { name: 'XL Desk Mouse Pad 90x40cm', price: 399, stock: 110, merchant: 0, description: 'Extended anti-fray mouse pad for keyboard + mouse.', attributes: { size_cm: '90x40', washable: true } },
      { name: '1080p USB Webcam with Mic', price: 2499, stock: 30, merchant: 0, description: 'Full HD webcam for online classes and meetings.', attributes: { resolution: '1080p', mic: true } },
      { name: '4-Port USB 3.0 Hub', price: 899, stock: 75, merchant: 0, description: 'Compact USB hub with individual switches.', attributes: { ports: 4, usb_version: '3.0' } },
      { name: 'HDMI 2.0 Cable 2m', price: 649, stock: 90, merchant: 0, description: '4K-ready high-speed HDMI cable.', attributes: { length_m: 2, version: '2.0' } },
      { name: 'Wireless Presenter R400', price: 1499, stock: 25, merchant: 0, description: 'Laser presenter with 15m range for classrooms.', attributes: { range_m: 15, laser: true } },
      { name: 'LED Desk Lamp with USB Port', price: 1099, stock: 48, merchant: 0, description: 'Eye-care desk lamp with 3 color modes.', attributes: { color_modes: 3, usb_port: true } },
      { name: 'Surge Protector 6-Socket', price: 799, stock: 70, merchant: 0, description: 'Spike-guard extension board with master switch.', attributes: { sockets: 6, spike_guard: true } },
      { name: 'Mini Bluetooth Speaker', price: 1999, stock: 38, merchant: 1, description: 'Portable speaker with 12-hour battery and TWS pairing.', attributes: { wireless: true, battery_hours: 12, waterproof: 'IPX5' } },
    ],
  };

  let created = 0;
  let skipped = 0;
  // Deterministic demo ratings derived from the product name (stable across runs).
  const ratingFor = (name: string): { rating: number; review_count: number } => {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
    return { rating: Number((4 + (hash % 10) / 10).toFixed(1)), review_count: 200 + (hash % 4800) };
  };
  for (const [catSlug, items] of Object.entries(catalog)) {
    for (const p of items) {
      const merchantId = merchants[p.merchant].id;
      const exists = await prisma.product.findFirst({
        where: { name: p.name, merchantId },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await prisma.product.create({
        data: {
          merchantId,
          categoryId: categories[catSlug].id,
          name: p.name,
          slug: slugify(p.name),
          description: p.description,
          price: p.price,
          currency: 'INR',
          stockQuantity: p.stock,
          status: p.status ?? (p.stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'),
          attributes: { ...p.attributes, ...ratingFor(p.name) },
          imageUrl: `https://cdn.razorpilot.local/images/${slugify(p.name)}.jpg`,
        },
      });
      created++;
    }
  }

  // ---- backfill ratings on pre-existing products (idempotent) ----
  const existing = await prisma.product.findMany({ select: { id: true, name: true, attributes: true } });
  let backfilled = 0;
  for (const row of existing) {
    const attrs = (row.attributes ?? {}) as Record<string, unknown>;
    if (typeof attrs['rating'] === 'number' && typeof attrs['review_count'] === 'number') continue;
    await prisma.product.update({
      where: { id: row.id },
      data: { attributes: { ...attrs, ...ratingFor(row.name) } },
    });
    backfilled++;
  }

  // ---- demo user ----
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Demo User', status: USER_STATUS.ACTIVE },
    create: {
      name: 'Demo User',
      email: DEMO_EMAIL,
      passwordHash: demoHash,
      status: USER_STATUS.ACTIVE,
    },
  });
  await prisma.userPreference.upsert({
    where: { userId: demo.id },
    update: {
      preferredCurrency: 'INR',
      maxBudget: 5000,
      preferences: {
        colors: ['black', 'blue'],
        avoid: ['RGB'],
        preferred_features: ['wireless', 'long_battery'],
        priorities: ['comfort', 'battery'],
        wireless: true,
      },
    },
    create: {
      userId: demo.id,
      preferredCurrency: 'INR',
      maxBudget: 5000,
      preferences: {
        colors: ['black', 'blue'],
        avoid: ['RGB'],
        preferred_features: ['wireless', 'long_battery'],
        priorities: ['comfort', 'battery'],
        wireless: true,
      },
    },
  });

  const totals = await prisma.product.count();
  console.log(`Seed complete: merchants=${merchants.length} products_created=${created} products_skipped=${skipped} ratings_backfilled=${backfilled} products_total=${totals}`);
  console.log(`Demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Demo merchants (all three): <merchant-email> / ${DEMO_MERCHANT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
