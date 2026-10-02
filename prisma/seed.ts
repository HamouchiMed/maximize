import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const url = rawUrl.startsWith("file:") ? rawUrl.slice("file:".length) : rawUrl;
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

// Deterministic placeholder imagery. Used only when no real photo exists.
const img = (seed: string) => `https://picsum.photos/seed/${seed}/900/1100`;

// Scan public/products for real photos named "<productNumber>-<n>.<ext>".
// Returns a map of product number -> ordered list of "/products/..." URLs.
const IMG_DIR = path.join(process.cwd(), "public", "products");
function loadLocalImages(): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (!fs.existsSync(IMG_DIR)) return map;
  const entries: { num: number; idx: number; file: string }[] = [];
  for (const file of fs.readdirSync(IMG_DIR)) {
    const m = file.match(/^(\d+)-(\d+)\.(avif|webp|png|jpe?g)$/i);
    if (!m) continue;
    entries.push({ num: parseInt(m[1], 10), idx: parseInt(m[2], 10), file });
  }
  entries.sort((a, b) => a.num - b.num || a.idx - b.idx);
  for (const e of entries) {
    if (!map.has(e.num)) map.set(e.num, []);
    map.get(e.num)!.push(`/products/${e.file}`);
  }
  return map;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 7)
    .join("-");
}

const categories = [
  { name: "Eyewear", slug: "eyewear" },
  { name: "Footwear", slug: "footwear" },
  { name: "Bags", slug: "bags" },
  { name: "Apparel", slug: "apparel" },
  { name: "Jewelry", slug: "jewelry" },
  { name: "Beauty", slug: "beauty" },
  { name: "Home & Kitchen", slug: "home" },
  { name: "Electronics", slug: "electronics" },
  { name: "Toys & Games", slug: "toys" },
  { name: "Accessories", slug: "accessories" },
];

type SeedProduct = {
  name: string;
  category: string;
  priceDH: number; // current price in Dirham
  compareDH?: number; // original / strikethrough price
  stock: number;
  featured?: boolean;
  badge?: string;
};

// Products transcribed from the user's Temu cart (prices in MAD / DH).
const products: SeedProduct[] = [
  {
    name: "3pcs Japanese-Style Wooden Tableware Set — Spoon, Chopsticks & Fork",
    category: "home",
    priceDH: 50,
    compareDH: 108,
    stock: 8,
    featured: true,
  },
  {
    name: "3pcs Vintage Rectangle & Oval Cat-Eye Frame Glasses",
    category: "eyewear",
    priceDH: 52,
    compareDH: 100,
    stock: 8,
  },
  {
    name: "Minimalist Art Deco Mirror — Suction Cup Mounted Round Wall Mirror",
    category: "home",
    priceDH: 101,
    compareDH: 233,
    stock: 8,
    featured: true,
  },
  {
    name: "8pcs Rick And Morty Shoe Buckle Charms — Detachable Shoe Ornaments",
    category: "accessories",
    priceDH: 36,
    compareDH: 80,
    stock: 8,
    badge: "New",
  },
  {
    name: "Kawaii Teddy Bear Plush Toy — Soft Stuffed Brown Bear Doll",
    category: "toys",
    priceDH: 67,
    compareDH: 138,
    stock: 20,
    featured: true,
  },
  {
    name: "Women's Long-Sleeve Pajama Pants — Sanrio Hello Kitty Print",
    category: "apparel",
    priceDH: 98,
    compareDH: 231,
    stock: 8,
  },
  {
    name: "Belly Dance Waist Scarf — Practice Belt / Carnival Costume Hip Wrap",
    category: "apparel",
    priceDH: 53,
    compareDH: 95,
    stock: 8,
  },
  {
    name: "A Premium Keychain — Black / Unisex",
    category: "accessories",
    priceDH: 31,
    compareDH: 78,
    stock: 40,
    badge: "Great Deal",
  },
  {
    name: "Angel Number 7 Temporary Tattoo — Waterproof Lucky Charm Design",
    category: "beauty",
    priceDH: 7,
    compareDH: 17,
    stock: 8,
  },
  {
    name: "Unisex Casual Commuting Mules — Comfortable Indoor Slippers (Khaki)",
    category: "footwear",
    priceDH: 165,
    compareDH: 357,
    stock: 8,
    featured: true,
  },
  {
    name: "334pcs Luxury Vintage Sports Car Building Block Set",
    category: "toys",
    priceDH: 86,
    compareDH: 194,
    stock: 15,
    featured: true,
  },
  {
    name: "Large-Font 3D LED Alarm Clock with Temperature Display (White)",
    category: "electronics",
    priceDH: 101,
    compareDH: 235,
    stock: 8,
  },
  {
    name: "Stylish Men's Oxford Backpack — Large Capacity for School & Travel",
    category: "bags",
    priceDH: 238,
    compareDH: 516,
    stock: 8,
    featured: true,
  },
  {
    name: "Fashionable Hip-Hop Nose Ring & Clip — Zirconia Inlay, No Piercing",
    category: "jewelry",
    priceDH: 9,
    compareDH: 20,
    stock: 40,
  },
  {
    name: "17pcs Car & Tire Croc Charms — DIY Detachable Clog Accessories",
    category: "accessories",
    priceDH: 29,
    compareDH: 59,
    stock: 8,
  },
  {
    name: "2pcs Unisex Y2K Trendy Fashion Glasses — Ultra-Light Vintage",
    category: "eyewear",
    priceDH: 40,
    compareDH: 87,
    stock: 8,
  },
  {
    name: "Vintage Oval Fashion Glasses — Tortoiseshell Frame, Black Lenses",
    category: "eyewear",
    priceDH: 29,
    compareDH: 72,
    stock: 60,
    badge: "Great Deal",
  },
  {
    name: "Men's Slip-On Beach Clogs — Comfortable Breathable Shoes (White)",
    category: "footwear",
    priceDH: 134,
    compareDH: 311,
    stock: 15,
  },
  {
    name: "Men's Summer Thick-Soled Beach Slippers — Non-Slip Soft Mules",
    category: "footwear",
    priceDH: 158,
    compareDH: 383,
    stock: 8,
  },
  {
    name: "Men's Coconut Slippers — EVA Integrated Molding (Off-White)",
    category: "footwear",
    priceDH: 87,
    compareDH: 189,
    stock: 8,
  },
  {
    name: "2026 Vintage Wide-Brim Sun Hat — Unisex Outdoor Bucket Hat (Beige)",
    category: "accessories",
    priceDH: 50,
    compareDH: 108,
    stock: 8,
  },
  {
    name: "Mini Handheld Fan — Portable Battery-Powered Cooling Fan (White)",
    category: "electronics",
    priceDH: 36,
    compareDH: 80,
    stock: 60,
    featured: true,
  },
  {
    name: "Women's Crochet Tote Bag 2pcs Set — Knitted Mesh Shoulder Bag",
    category: "bags",
    priceDH: 69,
    compareDH: 132,
    stock: 8,
  },
  {
    name: "Fujiko Horror Girl Decal Stickers — DIY Phone / Laptop Decoration",
    category: "accessories",
    priceDH: 18,
    compareDH: 40,
    stock: 11,
  },
  {
    name: "100pcs Assorted Graffiti Vinyl Sticker Pack",
    category: "accessories",
    priceDH: 44,
    compareDH: 114,
    stock: 17,
    badge: "Lightning Deal",
  },
  {
    name: "Magnetic Foldable Laptop Stand — 8 Height Levels, 3-Piece Set",
    category: "electronics",
    priceDH: 107,
    compareDH: 249,
    stock: 16,
    featured: true,
  },
  {
    name: "1080P HD USB Webcam — Privacy Cover & Noise-Cancelling Mic",
    category: "electronics",
    priceDH: 88,
    compareDH: 192,
    stock: 8,
    featured: true,
  },
  {
    name: "Windows Folder Vertical Laptop Stand — Holder for MacBook (Yellow)",
    category: "electronics",
    priceDH: 23,
    compareDH: 48,
    stock: 8,
    badge: "Lightning Deal",
  },
  {
    name: "Women's Sleep Hair Styling 8pcs Set — Satin Pillowcase (Pink)",
    category: "beauty",
    priceDH: 89,
    compareDH: 207,
    stock: 40,
  },
  {
    name: "Sanrio Hello Kitty Pop-Top Lid Cup — Round Top Mug / Water Bottle",
    category: "home",
    priceDH: 96,
    compareDH: 215,
    stock: 8,
    featured: true,
  },
  {
    name: "Daisy Flower Pillow Sewing Template — DIY Plush Throw Pillow Maker",
    category: "home",
    priceDH: 25,
    compareDH: 44,
    stock: 8,
  },
  {
    name: "3 Pairs Summer Women's Fashion Glasses — Daily & Photography",
    category: "eyewear",
    priceDH: 39,
    compareDH: 70,
    stock: 8,
  },
  {
    name: "Simple Versatile Fashionable Bracelet D249 (Silvery)",
    category: "jewelry",
    priceDH: 14,
    compareDH: 31,
    stock: 8,
  },
  {
    name: "Japanese-Style Unisex Backpack — Large 15.6\" Laptop Bag (Khaki)",
    category: "bags",
    priceDH: 185,
    compareDH: 428,
    stock: 8,
    featured: true,
  },
  {
    name: "22pcs Geometric Irregular Open Stackable Ring Set (Golden)",
    category: "jewelry",
    priceDH: 23,
    compareDH: 56,
    stock: 60,
    badge: "Big Sale",
  },
  {
    name: "Matte Water Bottle — Daisy Heart Bow 500ml Tassel Cup",
    category: "home",
    priceDH: 50,
    compareDH: 109,
    stock: 60,
  },
  {
    name: "Hello Kitty Detangling Hairbrush — Licensed Sanrio Paddle Brush",
    category: "beauty",
    priceDH: 32,
    compareDH: 69,
    stock: 8,
    featured: true,
  },
  {
    name: "Women's 2pcs Pajama Set — Autumn Heart Print Top & Shorts",
    category: "apparel",
    priceDH: 101,
    compareDH: 218,
    stock: 8,
  },
  {
    name: "5/8 Pairs Vintage Letter Printed Socks — Maillard Sports Socks",
    category: "apparel",
    priceDH: 81,
    compareDH: 176,
    stock: 60,
  },
  {
    name: "3pcs Niche Vintage Square Decorative Glasses (Black Orange Blue)",
    category: "eyewear",
    priceDH: 50,
    compareDH: 95,
    stock: 8,
  },
  {
    name: "Premium Style Tote Bag for Women — Large Capacity Shoulder Bag",
    category: "bags",
    priceDH: 84,
    compareDH: 196,
    stock: 16,
  },
  {
    name: "2pcs UV DTF Transfer Stickers — Bow Series for 40oz Tumbler",
    category: "accessories",
    priceDH: 24,
    compareDH: 51,
    stock: 8,
  },
  {
    name: "4pcs Shoe Crease Protectors — Anti-Wrinkle Sneaker Guards (Black)",
    category: "accessories",
    priceDH: 28,
    compareDH: 61,
    stock: 60,
  },
  {
    name: "Totem Armband Temporary Tattoo Sticker — Long-Lasting 1–2 Weeks",
    category: "beauty",
    priceDH: 11,
    compareDH: 23,
    stock: 8,
  },
  {
    name: "Roll-Top Daypack with Laptop Compartment — Durable Oxford (Green)",
    category: "bags",
    priceDH: 191,
    compareDH: 443,
    stock: 8,
    featured: true,
  },
  {
    name: "2pcs Double-Layer Butterfly Necklace — Rhinestone Neck Chain (Gold)",
    category: "jewelry",
    priceDH: 10,
    compareDH: 20,
    stock: 40,
    badge: "New",
  },
  {
    name: "3D Men's Casual Round-Neck T-Shirt — Breathable Regular Fit (Navy)",
    category: "apparel",
    priceDH: 75,
    compareDH: 161,
    stock: 10,
  },
  {
    name: "660pcs Lash Clusters Kit — Mixed 30D–80D with Lash Tool",
    category: "beauty",
    priceDH: 72,
    compareDH: 137,
    stock: 40,
    featured: true,
  },
];

// Deterministic pseudo-random for stable ratings/reviews per product index.
function pseudo(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  console.log("Seeding categories…");
  const categoryIdBySlug = new Map<string, string>();
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    categoryIdBySlug.set(c.slug, created.id);
  }

  console.log(`Seeding ${products.length} products…`);
  const localImages = loadLocalImages();
  console.log(`Found real photos for ${localImages.size} product(s).`);
  const usedSlugs = new Set<string>();
  let index = 0;
  for (const p of products) {
    index++;
    const categoryId = categoryIdBySlug.get(p.category);
    if (!categoryId) throw new Error(`Unknown category: ${p.category}`);

    let slug = slugify(p.name);
    if (usedSlugs.has(slug)) slug = `${slug}-${index}`;
    usedSlugs.add(slug);

    const rating = Math.round((4.2 + pseudo(index, 1) * 0.7) * 10) / 10; // 4.2–4.9
    const reviews = Math.floor(40 + pseudo(index, 2) * 2600);

    // Prefer real uploaded photos; fall back to deterministic placeholders.
    const local = localImages.get(index);
    const mainImage = local?.[0] ?? img(slug);
    const galleryImages =
      local && local.length > 1
        ? local.slice(1)
        : [img(`${slug}-b`), img(`${slug}-c`), img(`${slug}-d`)];

    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        description:
          `${p.name}. A customer favourite from our latest drop — limited-time price while stocks last. ` +
          `Quality-checked, fast shipping, and backed by our 30-day return promise.`,
        priceCents: p.priceDH * 100,
        compareAtCents: p.compareDH != null ? p.compareDH * 100 : null,
        currency: "mad",
        image: mainImage,
        images: JSON.stringify(galleryImages),
        rating,
        reviews,
        stock: p.stock,
        featured: p.featured ?? false,
        badge: p.badge ?? null,
        categoryId,
      },
    });
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
