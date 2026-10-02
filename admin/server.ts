import http from "node:http";
import { parse as parseUrl } from "node:url";
import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const PORT = Number(process.env.ADMIN_PANEL_PORT || 4000);
const HOST = process.env.ADMIN_PANEL_HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD ?? "";
const SESSION_HOURS = 12;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PANEL_PASSWORD is required in .env.local");
}

const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const dbUrl = rawUrl.startsWith("file:") ? rawUrl.slice("file:".length) : rawUrl;
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: dbUrl }),
});

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey)
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function money(centsValue: number | null | undefined): number | null {
  if (centsValue == null) return null;
  return Math.round(centsValue) / 100;
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function html(res: http.ServerResponse, body: string) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function fail(res: http.ServerResponse, message: string, status = 400) {
  json(res, { error: message }, status);
}

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  return types[ext] ?? "application/octet-stream";
}

function servePublicFile(res: http.ServerResponse, pathname: string) {
  const safePath = path
    .normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(process.cwd(), "public", safePath);
  const publicRoot = path.join(process.cwd(), "public");

  if (
    !filePath.startsWith(publicRoot) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    return false;
  }

  res.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "public, max-age=3600",
  });
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  });
  stream.pipe(res);
  return true;
}

function getCookies(req: http.IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function sessionSecret() {
  return createHmac("sha256", ADMIN_PASSWORD).update("admin-panel").digest("hex");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function createSessionCookie() {
  const payload = `${Date.now()}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

function isAuthed(req: http.IncomingMessage) {
  const token = getCookies(req).admin_session;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const actual = Buffer.from(parts[2]);
  const expected = Buffer.from(sign(payload));
  const createdAt = Number(parts[0]);
  const expired = Date.now() - createdAt > SESSION_HOURS * 60 * 60 * 1000;

  return (
    !expired &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function extensionForUpload(filename: string, contentType: string) {
  const fromName = path.extname(filename).toLowerCase();
  if ([".avif", ".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromName)) {
    return fromName;
  }

  const byType: Record<string, string> = {
    "image/avif": ".avif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  return byType[contentType] ?? "";
}

async function saveUploadedImage(req: http.IncomingMessage) {
  const contentTypeHeader = req.headers["content-type"] || "";
  const boundary = String(contentTypeHeader).match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ||
    String(contentTypeHeader).match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error("Upload must be multipart/form-data.");

  const raw = (await readRawBody(req)).toString("latin1");
  const part = raw
    .split(`--${boundary}`)
    .find((chunk) => chunk.includes('name="image"') && chunk.includes("filename="));
  if (!part) throw new Error("Choose an image file first.");

  const headerEnd = part.indexOf("\r\n\r\n");
  if (headerEnd === -1) throw new Error("Invalid upload.");

  const headers = part.slice(0, headerEnd);
  const filename = headers.match(/filename="([^"]*)"/)?.[1] || "upload";
  const uploadedType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
  const ext = extensionForUpload(filename, uploadedType);
  if (!ext) throw new Error("Only image files are allowed.");

  let body = part.slice(headerEnd + 4);
  body = body.replace(/\r\n--$/, "").replace(/\r\n$/, "");
  const file = Buffer.from(body, "latin1");
  if (file.length > 6 * 1024 * 1024) throw new Error("Image is too large. Max 6 MB.");

  const uploadDir = path.join(process.cwd(), "public", "products", "admin-uploads");
  mkdirSync(uploadDir, { recursive: true });

  const safeName = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "image";
  const storedName = `${Date.now()}-${randomBytes(5).toString("hex")}-${safeName}${ext}`;
  const storedPath = path.join(uploadDir, storedName);
  writeFileSync(storedPath, file);

  return `/products/admin-uploads/${storedName}`;
}

function listGalleryImages() {
  const root = path.join(process.cwd(), "public", "products");
  const allowed = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  const images: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (allowed.has(path.extname(entry).toLowerCase())) {
        images.push(`/${path.relative(path.join(process.cwd(), "public"), full).replace(/\\/g, "/")}`);
      }
    }
  }

  walk(root);
  return images.sort();
}

function normalizeProduct(product: any) {
  const reduction =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
      : 0;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: money(product.priceCents),
    compareAt: money(product.compareAtCents),
    reduction,
    currency: product.currency,
    image: product.image,
    images: product.images,
    rating: product.rating,
    reviews: product.reviews,
    stock: product.stock,
    featured: product.featured,
    badge: product.badge,
    categoryId: product.categoryId,
    category: product.category?.name ?? "",
    createdAt: product.createdAt,
  };
}

async function requireProductItems(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one order item.");
  }

  const normalized = items
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        productId: String(row.productId || ""),
        quantity: Math.max(1, Math.floor(Number(row.quantity || 1))),
      };
    })
    .filter((item) => item.productId);

  if (!normalized.length) throw new Error("Add at least one product.");

  const products = await prisma.product.findMany({
    where: { id: { in: normalized.map((item) => item.productId) } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return normalized.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new Error("One selected product no longer exists.");

    return {
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      quantity: item.quantity,
    };
  });
}

async function api(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    if (String(body.password || "") !== ADMIN_PASSWORD) {
      return fail(res, "Wrong admin password.", 401);
    }

    res.setHeader(
      "set-cookie",
      `admin_session=${encodeURIComponent(createSessionCookie())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${
        SESSION_HOURS * 60 * 60
      }`
    );
    return json(res, { ok: true });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    res.setHeader(
      "set-cookie",
      "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    );
    return json(res, { ok: true });
  }

  if (!isAuthed(req)) return fail(res, "Unauthorized.", 401);

  if (pathname === "/api/uploads" && req.method === "POST") {
    const imagePath = await saveUploadedImage(req);
    return json(res, { path: imagePath }, 201);
  }

  if (pathname === "/api/gallery" && req.method === "GET") {
    return json(res, { images: listGalleryImages() });
  }

  if (pathname === "/api/health" && req.method === "GET") {
    const startedAt = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return json(res, {
        ok: true,
        provider: "sqlite",
        database: path.basename(dbUrl),
        responseMs: Date.now() - startedAt,
        checkedAt: new Date(),
      });
    } catch (err) {
      return json(
        res,
        {
          ok: false,
          provider: "sqlite",
          database: path.basename(dbUrl),
          error: err instanceof Error ? err.message : "Database unreachable.",
          checkedAt: new Date(),
        },
        200
      );
    }
  }

  if (pathname === "/api/summary" && req.method === "GET") {
    const startedAt = Date.now();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [
      users,
      products,
      categories,
      orders,
      coupons,
      messages,
      wishlist,
      addresses,
      sessions,
      paidCount,
      pendingCount,
      failedCount,
      usersLast24h,
      ordersLast24h,
      paid,
      pending,
      activeSessions,
      recentOrders,
      recentUsers,
      recentMessages,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.coupon.count(),
      prisma.supportMessage.count(),
      prisma.wishlistItem.count(),
      prisma.address.count(),
      prisma.session.count(),
      prisma.order.count({ where: { status: "paid" } }),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { status: "failed" } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.order.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.order.aggregate({ where: { status: "paid" }, _sum: { amountTotal: true } }),
      prisma.order.aggregate({ where: { status: "pending" }, _sum: { amountTotal: true } }),
      prisma.session.findMany({
        where: { expiresAt: { gt: now } },
        take: 25,
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
      prisma.order.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
      prisma.user.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
      prisma.supportMessage.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
    ]);

    return json(res, {
      health: {
        ok: true,
        provider: "sqlite",
        database: path.basename(dbUrl),
        responseMs: Date.now() - startedAt,
        checkedAt: now,
      },
      counts: {
        users,
        products,
        categories,
        orders,
        coupons,
        messages,
        wishlist,
        addresses,
        sessions,
        activeSessions: activeSessions.length,
        usersLast24h,
        ordersLast24h,
        paidRevenue: money(paid._sum.amountTotal ?? 0),
        pendingRevenue: money(pending._sum.amountTotal ?? 0),
      },
      ordersByStatus: { paid: paidCount, pending: pendingCount, failed: failedCount },
      liveUsers: activeSessions.map((session) => ({
        id: session.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        signedInAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        email: order.email,
        user: order.user?.email ?? null,
        total: money(order.amountTotal),
        status: order.status,
        createdAt: order.createdAt,
      })),
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      })),
      recentMessages: recentMessages.map((message) => ({
        id: message.id,
        email: message.user.email,
        subject: message.subject,
        createdAt: message.createdAt,
      })),
    });
  }

  if (pathname === "/api/users" && req.method === "GET") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true, wishlist: true, messages: true, addresses: true } },
      },
    });

    return json(res, {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        country: user.country,
        image: user.image,
        google: Boolean(user.googleId),
        hasPassword: Boolean(user.passwordHash),
        preferredPayment: user.preferredPayment,
        createdAt: user.createdAt,
        counts: user._count,
      })),
    });
  }

  const userPassword = pathname.match(/^\/api\/users\/([^/]+)\/password$/);
  if (userPassword && req.method === "POST") {
    const body = await readBody(req);
    const password = String(body.password || "");
    if (password.length < 8) return fail(res, "Password must be at least 8 characters.");

    await prisma.user.update({
      where: { id: userPassword[1] },
      data: { passwordHash: await hashPassword(password) },
    });
    return json(res, { ok: true });
  }

  const userRoute = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userRoute && req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: userRoute[1] },
      include: {
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        sessions: { orderBy: { createdAt: "desc" } },
        messages: { orderBy: { createdAt: "desc" } },
        wishlist: {
          orderBy: { createdAt: "desc" },
          include: { product: true },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    });
    if (!user) return fail(res, "User not found.", 404);

    return json(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        country: user.country,
        preferredPayment: user.preferredPayment,
        google: Boolean(user.googleId),
        googleIdPreview: user.googleId ? `${user.googleId.slice(0, 8)}...` : null,
        googleAccessToken: user.googleAccessToken,
        hasRefreshToken: Boolean(user.googleRefreshToken),
        googleTokenExpiry: user.googleTokenExpiry,
        tokenExpired: user.googleTokenExpiry ? user.googleTokenExpiry < new Date() : null,
        hasPassword: Boolean(user.passwordHash),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        addresses: user.addresses.map((address) => ({
          id: address.id,
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          city: address.city,
          region: address.region,
          isDefault: address.isDefault,
          createdAt: address.createdAt,
        })),
        sessions: user.sessions.map((session) => ({
          id: session.id,
          tokenPreview: `${session.token.slice(0, 6)}...${session.token.slice(-4)}`,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          expired: session.expiresAt < new Date(),
        })),
        orders: user.orders.map((order) => ({
          id: order.id,
          status: order.status,
          email: order.email,
          total: money(order.amountTotal),
          discount: money(order.discountCents),
          couponCode: order.couponCode,
          currency: order.currency,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            name: item.name,
            price: money(item.priceCents),
            quantity: item.quantity,
          })),
        })),
        wishlist: user.wishlist.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            image: item.product.image,
            price: money(item.product.priceCents),
          },
        })),
        messages: user.messages.map((message) => ({
          id: message.id,
          subject: message.subject,
          body: message.body,
          createdAt: message.createdAt,
        })),
      },
    });
  }

  if (userRoute && req.method === "PATCH") {
    const body = await readBody(req);
    const user = await prisma.user.update({
      where: { id: userRoute[1] },
      data: {
        name: String(body.name || "").trim() || null,
        country: String(body.country || "").trim() || null,
        preferredPayment:
          body.preferredPayment === "card" || body.preferredPayment === "cod"
            ? String(body.preferredPayment)
            : null,
      },
    });
    return json(res, { user: { id: user.id } });
  }

  if (pathname === "/api/categories" && req.method === "GET") {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return json(res, { categories });
  }

  if (pathname === "/api/categories" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return fail(res, "Category name is required.");

    const category = await prisma.category.create({
      data: {
        name,
        slug: slugify(String(body.slug || name)),
      },
    });
    return json(res, { category }, 201);
  }

  const categoryRoute = pathname.match(/^\/api\/categories\/([^/]+)$/);
  if (categoryRoute && req.method === "PATCH") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return fail(res, "Category name is required.");

    const category = await prisma.category.update({
      where: { id: categoryRoute[1] },
      data: {
        name,
        slug: slugify(String(body.slug || name)),
      },
    });
    return json(res, { category });
  }

  if (categoryRoute && req.method === "DELETE") {
    await prisma.category.delete({ where: { id: categoryRoute[1] } });
    return json(res, { ok: true });
  }

  if (pathname === "/api/products" && req.method === "GET") {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });
    return json(res, { products: products.map(normalizeProduct) });
  }

  if (pathname === "/api/products" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const categoryId = String(body.categoryId || "");
    if (!name || !categoryId) return fail(res, "Product name and category are required.");

    const product = await prisma.product.create({
      data: {
        name,
        slug: slugify(String(body.slug || name)),
        description: String(body.description || "").trim() || "No description yet.",
        priceCents: cents(body.price),
        compareAtCents: body.compareAt ? cents(body.compareAt) : null,
        currency: String(body.currency || "mad").toLowerCase(),
        image: String(body.image || "/products/1-1.avif").trim(),
        images: String(body.images || "[]").trim() || "[]",
        rating: Number(body.rating || 4.5),
        reviews: Math.max(0, Math.floor(Number(body.reviews || 0))),
        stock: Math.max(0, Math.floor(Number(body.stock || 0))),
        featured: Boolean(body.featured),
        badge: String(body.badge || "").trim() || null,
        categoryId,
      },
      include: { category: true },
    });
    return json(res, { product: normalizeProduct(product) }, 201);
  }

  const productRoute = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productRoute && req.method === "PATCH") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return fail(res, "Product name is required.");

    const product = await prisma.product.update({
      where: { id: productRoute[1] },
      data: {
        name,
        slug: slugify(String(body.slug || name)),
        description: String(body.description || "").trim() || "No description yet.",
        priceCents: cents(body.price),
        compareAtCents: body.compareAt ? cents(body.compareAt) : null,
        currency: String(body.currency || "mad").toLowerCase(),
        image: String(body.image || "/products/1-1.avif").trim(),
        images: String(body.images || "[]").trim() || "[]",
        rating: Number(body.rating || 4.5),
        reviews: Math.max(0, Math.floor(Number(body.reviews || 0))),
        stock: Math.max(0, Math.floor(Number(body.stock || 0))),
        featured: Boolean(body.featured),
        badge: String(body.badge || "").trim() || null,
        categoryId: String(body.categoryId || ""),
      },
      include: { category: true },
    });
    return json(res, { product: normalizeProduct(product) });
  }

  if (productRoute && req.method === "DELETE") {
    await prisma.product.delete({ where: { id: productRoute[1] } });
    return json(res, { ok: true });
  }

  if (pathname === "/api/orders" && req.method === "GET") {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true, user: true },
      take: 200,
    });

    return json(res, {
      orders: orders.map((order) => ({
        id: order.id,
        email: order.email,
        userId: order.userId,
        user: order.user?.email ?? null,
        status: order.status,
        total: money(order.amountTotal),
        discount: money(order.discountCents),
        refunded: money(order.refundedCents),
        couponCode: order.couponCode,
        currency: order.currency,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          price: money(item.priceCents),
          quantity: item.quantity,
        })),
        createdAt: order.createdAt,
      })),
    });
  }

  const orderPayment = pathname.match(/^\/api\/orders\/([^/]+)\/payment$/);
  if (orderPayment && req.method === "GET") {
    const order = await prisma.order.findUnique({
      where: { id: orderPayment[1] },
      include: { events: { orderBy: { createdAt: "asc" } }, items: true },
    });
    if (!order) return fail(res, "Order not found.", 404);

    const provider = order.stripeSessionId ? "stripe" : "youcanpay";
    return json(res, {
      payment: {
        id: order.id,
        status: order.status,
        provider,
        paymentMethod: order.paymentMethod,
        paymentRef: order.paymentRef,
        receiptUrl: order.receiptUrl,
        cancelReason: order.cancelReason,
        refundRib: order.refundRib,
        refundStatus: order.refundStatus,
        refundStatusAt: order.refundStatusAt,
        refundNote: order.refundNote,
        email: order.email,
        currency: order.currency,
        total: money(order.amountTotal),
        discount: money(order.discountCents),
        refunded: money(order.refundedCents),
        refundReason: order.refundReason,
        refundedAt: order.refundedAt,
        couponCode: order.couponCode,
        youcanTokenId: order.youcanTokenId,
        youcanTransactionId: order.youcanTransactionId,
        stripeSessionId: order.stripeSessionId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        events: order.events.map((event) => ({
          id: event.id,
          type: event.type,
          message: event.message,
          provider: event.provider,
          amount: money(event.amountCents),
          createdAt: event.createdAt,
        })),
      },
    });
  }

  const orderConfirmPay = pathname.match(/^\/api\/orders\/([^/]+)\/confirm-payment$/);
  if (orderConfirmPay && req.method === "POST") {
    const order = await prisma.order.findUnique({ where: { id: orderConfirmPay[1] } });
    if (!order) return fail(res, "Order not found.", 404);
    if (order.status === "paid") return json(res, { ok: true, status: "paid" });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "paid" },
    });
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        type: "manual_paid",
        provider: order.paymentMethod === "prepaid" ? "prepaid" : "manual",
        amountCents: order.amountTotal,
        message:
          "Payment confirmed manually in admin" +
          (order.paymentRef ? ` (ref: ${order.paymentRef})` : "") +
          ".",
      },
    });
    return json(res, { ok: true, status: "paid" });
  }

  const orderRefundStatus = pathname.match(/^\/api\/orders\/([^/]+)\/refund-status$/);
  if (orderRefundStatus && req.method === "POST") {
    const body = await readBody(req);
    const stages = ["requested", "reviewing", "processing", "sent", "rejected"];
    const stage = stages.includes(String(body.stage)) ? String(body.stage) : "";
    if (!stage) return fail(res, "Invalid refund stage.");

    const order = await prisma.order.findUnique({ where: { id: orderRefundStatus[1] } });
    if (!order) return fail(res, "Order not found.", 404);

    const note = String(body.note || "").trim() || null;
    await prisma.order.update({
      where: { id: order.id },
      data: { refundStatus: stage, refundStatusAt: new Date(), refundNote: note },
    });
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        type: "refund_status",
        provider: "prepaid",
        message: `Refund status set to "${stage}"` + (note ? ` — ${note}` : "") + ".",
      },
    });
    return json(res, { ok: true, refundStatus: stage });
  }

  const orderRefund = pathname.match(/^\/api\/orders\/([^/]+)\/refund$/);
  if (orderRefund && req.method === "POST") {
    const body = await readBody(req);
    const order = await prisma.order.findUnique({ where: { id: orderRefund[1] } });
    if (!order) return fail(res, "Order not found.", 404);

    const requested = body.amount == null || body.amount === "" ? order.amountTotal : cents(body.amount);
    const refundedCents = Math.min(Math.max(0, requested), order.amountTotal);
    if (refundedCents <= 0) return fail(res, "Refund amount must be greater than zero.");
    const reason = String(body.reason || "").trim() || null;
    const isFull = refundedCents >= order.amountTotal;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: isFull ? "refunded" : order.status,
        refundedCents,
        refundReason: reason,
        refundedAt: new Date(),
      },
    });
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        type: "refunded",
        provider: order.stripeSessionId ? "stripe" : "youcanpay",
        amountCents: refundedCents,
        message:
          (isFull ? "Full refund" : "Partial refund") +
          " recorded in admin" +
          (reason ? `: ${reason}` : "") +
          ". Issue the money-back in the payment provider dashboard.",
      },
    });
    return json(res, { ok: true, refunded: money(refundedCents), status: isFull ? "refunded" : order.status });
  }

  if (pathname === "/api/fulfillment" && req.method === "GET") {
    const orders = await prisma.order.findMany({
      where: { status: { in: ["paid", "refunded"] } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 300,
    });

    let revenueCents = 0;
    let costCents = 0;
    const rows = orders.map((order) => {
      revenueCents += order.amountTotal;
      costCents += order.supplierCostCents;
      return {
        id: order.id,
        email: order.email,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        total: money(order.amountTotal),
        supplierCost: money(order.supplierCostCents),
        profit: money(order.amountTotal - order.supplierCostCents),
        supplier: order.supplier,
        supplierOrderId: order.supplierOrderId,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        fulfillmentNotes: order.fulfillmentNotes,
        currentLocation: order.currentLocation,
        locationUpdatedAt: order.locationUpdatedAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        ship: {
          name: order.shipName,
          phone: order.shipPhone,
          line1: order.shipLine1,
          city: order.shipCity,
          region: order.shipRegion,
        },
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt,
      };
    });

    return json(res, {
      fulfillment: rows,
      fulfillmentTotals: {
        orders: rows.length,
        revenue: money(revenueCents),
        supplierCost: money(costCents),
        profit: money(revenueCents - costCents),
        awaiting: rows.filter((r) => r.fulfillmentStatus === "awaiting").length,
        ordered: rows.filter((r) => r.fulfillmentStatus === "ordered").length,
        shipped: rows.filter((r) => r.fulfillmentStatus === "shipped").length,
        delivered: rows.filter((r) => r.fulfillmentStatus === "delivered").length,
      },
    });
  }

  const orderFulfillment = pathname.match(/^\/api\/orders\/([^/]+)\/fulfillment$/);
  if (orderFulfillment && req.method === "PATCH") {
    const body = await readBody(req);
    const existing = await prisma.order.findUnique({ where: { id: orderFulfillment[1] } });
    if (!existing) return fail(res, "Order not found.", 404);

    const statuses = ["awaiting", "ordered", "shipped", "delivered"];
    const fulfillmentStatus = statuses.includes(String(body.fulfillmentStatus))
      ? String(body.fulfillmentStatus)
      : existing.fulfillmentStatus;

    const newLocation = String(body.currentLocation || "").trim() || null;
    const locationChanged = newLocation !== (existing.currentLocation ?? null);
    const order = await prisma.order.update({
      where: { id: orderFulfillment[1] },
      data: {
        supplier: String(body.supplier || "").trim() || null,
        supplierOrderId: String(body.supplierOrderId || "").trim() || null,
        supplierCostCents: cents(body.supplierCost),
        fulfillmentStatus,
        trackingNumber: String(body.trackingNumber || "").trim() || null,
        carrier: String(body.carrier || "").trim() || null,
        fulfillmentNotes: String(body.fulfillmentNotes || "").trim() || null,
        currentLocation: newLocation,
        locationUpdatedAt: locationChanged ? new Date() : existing.locationUpdatedAt,
        // Stamp timestamps the first time an order reaches each stage.
        shippedAt:
          fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered"
            ? existing.shippedAt ?? new Date()
            : existing.shippedAt,
        deliveredAt:
          fulfillmentStatus === "delivered"
            ? existing.deliveredAt ?? new Date()
            : existing.deliveredAt,
      },
    });
    return json(res, { order: { id: order.id } });
  }

  if (pathname === "/api/orders" && req.method === "POST") {
    const body = await readBody(req);
    const userId = String(body.userId || "");
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const items = await requireProductItems(body.items);
    const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const discountCents = cents(body.discount);
    const total = Math.max(0, subtotal - discountCents);
    const email = String(body.email || user?.email || "").trim().toLowerCase();
    if (!email) return fail(res, "Order email is required.");

    const order = await prisma.order.create({
      data: {
        email,
        userId: user?.id ?? null,
        status: String(body.status || "pending"),
        amountTotal: total,
        currency: String(body.currency || "mad").toLowerCase(),
        couponCode: String(body.couponCode || "").trim() || null,
        discountCents,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            priceCents: item.priceCents,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return json(res, { order: { id: order.id } }, 201);
  }

  const orderRoute = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderRoute && req.method === "PATCH") {
    const body = await readBody(req);
    const existing = await prisma.order.findUnique({
      where: { id: orderRoute[1] },
      include: { items: true },
    });
    if (!existing) return fail(res, "Order not found.", 404);

    const hasNewItems = Array.isArray(body.items) && body.items.length > 0;
    const items = hasNewItems
      ? await requireProductItems(body.items)
      : existing.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          priceCents: item.priceCents,
          quantity: item.quantity,
        }));
    const discountCents = cents(body.discount);
    const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

    const order = await prisma.order.update({
      where: { id: orderRoute[1] },
      data: {
        status: String(body.status || "pending"),
        email: String(body.email || "").trim().toLowerCase(),
        couponCode: String(body.couponCode || "").trim() || null,
        discountCents,
        amountTotal: Math.max(0, subtotal - discountCents),
        ...(hasNewItems
          ? {
              items: {
                deleteMany: {},
                create: items.map((item) => ({
                  productId: item.productId,
                  name: item.name,
                  priceCents: item.priceCents,
                  quantity: item.quantity,
                })),
              },
            }
          : {}),
      },
    });
    return json(res, { order: { id: order.id } });
  }

  if (orderRoute && req.method === "DELETE") {
    await prisma.orderItem.deleteMany({ where: { orderId: orderRoute[1] } });
    await prisma.order.delete({ where: { id: orderRoute[1] } });
    return json(res, { ok: true });
  }

  if (pathname === "/api/coupons" && req.method === "GET") {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    return json(res, {
      coupons: coupons.map((coupon) => ({
        ...coupon,
        minSubtotal: money(coupon.minSubtotalCents),
      })),
    });
  }

  if (pathname === "/api/coupons" && req.method === "POST") {
    const body = await readBody(req);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return fail(res, "Coupon code is required.");

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description: String(body.description || "").trim() || "Discount",
        kind: body.kind === "fixed" ? "fixed" : "percent",
        value:
          body.kind === "fixed"
            ? cents(body.value)
            : Math.max(0, Math.floor(Number(body.value || 0))),
        minSubtotalCents: cents(body.minSubtotal),
        active: body.active !== false,
      },
    });
    return json(res, { coupon }, 201);
  }

  const couponRoute = pathname.match(/^\/api\/coupons\/([^/]+)$/);
  if (couponRoute && req.method === "PATCH") {
    const body = await readBody(req);
    const coupon = await prisma.coupon.update({
      where: { id: couponRoute[1] },
      data: {
        code: String(body.code || "").trim().toUpperCase(),
        description: String(body.description || "").trim() || "Discount",
        kind: body.kind === "fixed" ? "fixed" : "percent",
        value:
          body.kind === "fixed"
            ? cents(body.value)
            : Math.max(0, Math.floor(Number(body.value || 0))),
        minSubtotalCents: cents(body.minSubtotal),
        active: Boolean(body.active),
      },
    });
    return json(res, { coupon });
  }

  if (couponRoute && req.method === "DELETE") {
    await prisma.coupon.delete({ where: { id: couponRoute[1] } });
    return json(res, { ok: true });
  }

  if (pathname === "/api/messages" && req.method === "GET") {
    const messages = await prisma.supportMessage.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true },
      take: 200,
    });
    return json(res, {
      messages: messages.map((message) => ({
        id: message.id,
        subject: message.subject,
        body: message.body,
        user: message.user.email,
        createdAt: message.createdAt,
      })),
    });
  }

  fail(res, "Route not found.", 404);
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maximize Admin</title>
  <style>
    :root{--bg:#eef1f7;--panel:#fff;--ink:#0f172a;--muted:#64748b;--border:#e6e9f1;--accent:#4f39f6;--accent-2:#7c5cff;--danger:#dc2626;--good:#10b981;--warn:#d97706;--shadow:0 1px 2px #0f172a0a,0 6px 20px -8px #0f172a1f;--shadow-lg:0 20px 60px -12px #0f172a33;--radius:16px}
    *{box-sizing:border-box}
    html{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
    body{margin:0;color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);background-image:radial-gradient(1200px 600px at 100% -10%,#e5e0ff80,transparent),radial-gradient(1000px 500px at -10% 0%,#dbeafe80,transparent)}
    button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;transition:all .16s ease}
    ::selection{background:#4f39f633}
    ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:#cbd2e0;border-radius:999px;border:2px solid transparent;background-clip:content-box}::-webkit-scrollbar-thumb:hover{background:#aab3c5;background-clip:content-box}
    .login{min-height:100vh;display:grid;place-items:center;padding:24px}.login-card{width:min(420px,100%);background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:var(--shadow-lg)}
    .login-card h1{margin:0 0 8px;font-size:26px;letter-spacing:-.02em}.login-card p{margin:0 0 22px;color:var(--muted)}.login-card input{width:100%;border:1px solid var(--border);border-radius:12px;padding:13px}
    .primary{border:0;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:12px;padding:11px 16px;font-weight:700;box-shadow:0 6px 16px -6px #4f39f6aa}.primary:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 10px 22px -8px #4f39f6aa}.primary:active{transform:translateY(0)}
    .ghost{border:1px solid var(--border);background:#fff;color:var(--ink);border-radius:12px;padding:10px 13px;font-weight:600}.ghost:hover{background:#f7f8fc;border-color:#d7dce8;transform:translateY(-1px)}.ghost:disabled{opacity:.6;cursor:not-allowed;transform:none}.danger{color:var(--danger)}.ghost.danger:hover{background:#fef2f2;border-color:#fecaca}
    .app{display:none;min-height:100vh}.shell{display:grid;grid-template-columns:256px minmax(0,1fr);min-height:100vh}
    .side{background:linear-gradient(180deg,#1b1c2b,#111119);color:#fff;padding:22px 16px;position:sticky;top:0;height:100vh;box-shadow:inset -1px 0 0 #ffffff10}
    .brand{font-size:18px;font-weight:800;letter-spacing:.06em;margin:4px 8px 22px;display:flex;align-items:center;gap:9px}.brand:before{content:"";width:12px;height:12px;border-radius:4px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 14px #7c5cffaa}
    .nav{display:flex;flex-direction:column;gap:4px}.nav button{color:#c3c6d4;background:transparent;border:0;text-align:left;border-radius:11px;padding:11px 13px;font-weight:600;position:relative;transition:all .15s ease}.nav button:hover{background:#ffffff12;color:#fff}.nav button.active{background:#ffffff16;color:#fff}.nav button.active:before{content:"";position:absolute;left:-16px;top:50%;transform:translateY(-50%);width:4px;height:22px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,var(--accent),var(--accent-2))}
    .main{padding:26px 28px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:22px}.top h1{margin:0;font-size:30px;letter-spacing:-.02em}.muted{color:var(--muted)}
    .avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:linear-gradient(135deg,#eef0ff,#e6e0ff);color:var(--accent);display:inline-grid;place-items:center;font-weight:800;vertical-align:middle;border:1px solid #e6e9f1}.user-cell{display:flex;align-items:center;gap:10px}
    .detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.detail-box{border:1px solid var(--border);border-radius:14px;padding:14px;background:#fbfbfe}.detail-box h4{margin:0 0 8px}.stack{display:grid;gap:8px}.token-note{border-left:3px solid var(--accent);padding:10px 12px;background:#f5f3ff;color:#4338ca;border-radius:10px}
    .product-cell{display:flex;align-items:center;gap:12px;min-width:280px}.product-thumb{width:60px;height:60px;border-radius:12px;object-fit:cover;background:#f3f4f6;border:1px solid var(--border);flex-shrink:0}.product-preview{width:100%;max-height:280px;object-fit:contain;background:#f8fafc;border:1px solid var(--border);border-radius:14px}.image-strip{display:flex;gap:8px;overflow-x:auto;padding-top:8px}.image-strip img{width:72px;height:72px;border-radius:10px;object-fit:cover;border:1px solid var(--border);background:#f3f4f6}
    .image-manager{display:grid;gap:12px}.image-row{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:10px;align-items:center}.image-row img{width:72px;height:72px;border-radius:10px;object-fit:cover;background:#f3f4f6;border:1px solid var(--border)}.image-actions{display:flex;gap:8px;justify-content:space-between;align-items:center}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);transition:transform .18s ease,box-shadow .18s ease}
    .card h3{margin:0 0 12px;font-size:16px;letter-spacing:-.01em}
    .grid .card:hover,.cols .card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
    .metric{font-size:30px;font-weight:800;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .stat{display:flex;align-items:flex-start;gap:14px}.stat-ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;font-size:22px;flex-shrink:0;background:color-mix(in srgb,var(--c,var(--accent)) 15%,#fff);color:var(--c,var(--accent));border:1px solid color-mix(in srgb,var(--c,var(--accent)) 22%,#fff)}.stat-body{min-width:0}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.section{display:none}.section.active{display:block;animation:fade .2s ease}@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    table{width:100%;border-collapse:separate;border-spacing:0;background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
    th,td{padding:12px 14px;border-bottom:1px solid var(--border);text-align:left;vertical-align:middle;font-size:14px}
    th{background:#f8f9fc;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    tbody tr{transition:background .12s ease}tbody tr:hover{background:#f7f8fc}tr:last-child td{border-bottom:0}
    td[onclick],.product-cell[onclick]{transition:color .12s ease}td[onclick]:hover{color:var(--accent)}
    .toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:0 0 16px}.toolbar h2{margin:0;font-size:20px;letter-spacing:-.01em}
    .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .pill{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;background:#fff}
    .pill.live{color:var(--good);background:#ecfdf5;border-color:#a7f3d0}
    .pill.f-await{color:#6b7280;background:#f3f4f6;border-color:#e5e7eb}.pill.f-order{color:#1d4ed8;background:#eff6ff;border-color:#bfdbfe}.pill.f-ship{color:#b45309;background:#fffbeb;border-color:#fde68a}.pill.f-done{color:#047857;background:#ecfdf5;border-color:#a7f3d0}
    a.ghost{text-decoration:none;display:inline-flex;align-items:center}
    .paid{color:var(--good)}.pending{color:var(--warn)}.failed{color:var(--danger)}.refunded{color:#7c3aed}.cancelled{color:var(--danger);font-weight:700}
    .timeline{display:grid;gap:0;margin:6px 0}.tl{position:relative;padding:0 0 16px 22px;border-left:2px solid var(--border)}.tl:last-child{border-left-color:transparent;padding-bottom:0}.tl:before{content:"";position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid #fff;box-shadow:0 0 0 1px var(--border)}.tl.ok:before{background:var(--good)}.tl.bad:before{background:var(--danger)}.tl.warn:before{background:var(--warn)}.tl.refund:before{background:#7c3aed}.tl h5{margin:0;font-size:13px;text-transform:capitalize}.tl .when{color:var(--muted);font-size:12px}.tl p{margin:3px 0 0;font-size:13px;color:#374151}
    .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px}.kv b{color:var(--muted);font-weight:600}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
    dialog{border:0;border-radius:18px;box-shadow:var(--shadow-lg);width:min(760px,calc(100vw - 30px));padding:0}dialog::backdrop{background:#0f172a66;backdrop-filter:blur(2px)}.modal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border)}.modal-body{padding:18px}
    form{display:grid;gap:12px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:5px;font-size:13px;font-weight:700}
    input,select,textarea{border:1px solid var(--border);border-radius:11px;padding:10px 12px;background:#fff;transition:border-color .14s ease,box-shadow .14s ease}input:focus,select:focus,textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px #4f39f625}
    textarea{min-height:90px;resize:vertical}.full{grid-column:1/-1}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.small{font-size:12px}.message{white-space:pre-wrap;max-width:520px}
    @media(max-width:900px){.shell{grid-template-columns:1fr}.side{position:static;height:auto}.nav{flex-direction:row;overflow-x:auto}.nav button.active:before{display:none}.grid,.cols,.form-grid,.detail-grid{grid-template-columns:1fr}.image-row{grid-template-columns:56px minmax(0,1fr)}.image-row button{grid-column:2}.main{padding:16px}table{display:block;overflow-x:auto;white-space:nowrap}}
  </style>
</head>
<body>
  <div class="login" id="login">
    <form class="login-card" id="loginForm">
      <h1>Maximize Admin</h1>
      <p>Protected control panel for the store.</p>
      <label>Admin password<input id="adminPassword" type="password" autocomplete="current-password" required /></label>
      <button class="primary" style="width:100%;margin-top:14px">Open admin panel</button>
      <p class="danger small" id="loginError" style="margin-top:12px"></p>
    </form>
  </div>

  <div class="app" id="app">
    <div class="shell">
      <aside class="side">
        <div class="brand">MAXIMIZE ADMIN</div>
        <nav class="nav" id="nav"></nav>
      </aside>
      <main class="main">
        <div class="top">
          <div><h1 id="title">Dashboard</h1><div class="muted">Separate admin panel connected to the store database. <span id="updatedAt"></span></div></div>
          <div class="row"><button class="ghost" id="refresh">↻ Refresh</button><button class="ghost" id="logout">Log out</button></div>
        </div>
        <section class="section active" id="dashboard"></section>
        <section class="section" id="users"></section>
        <section class="section" id="products"></section>
        <section class="section" id="categories"></section>
        <section class="section" id="orders"></section>
        <section class="section" id="fulfillment"></section>
        <section class="section" id="coupons"></section>
        <section class="section" id="messages"></section>
      </main>
    </div>
  </div>

  <dialog id="modal">
    <div class="modal-head"><strong id="modalTitle"></strong><button class="ghost" onclick="modal.close()">Close</button></div>
    <div class="modal-body" id="modalBody"></div>
  </dialog>

  <script>
    const state = { tab: "dashboard", users: [], categories: [], products: [], orders: [], coupons: [], messages: [], gallery: [], fulfillment: [], fulfillmentTotals: {} };
    const tabs = [
      ["dashboard", "Dashboard"], ["users", "Users"], ["products", "Products"], ["categories", "Categories"],
      ["orders", "Orders"], ["fulfillment", "Fulfillment"], ["coupons", "Coupons"], ["messages", "Messages"]
    ];
    const money = v => v == null ? "-" : new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(v);
    const date = v => new Date(v).toLocaleString();
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;" }[c]));

    async function req(path, options = {}) {
      const res = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    function showApp() {
      login.style.display = "none";
      app.style.display = "block";
      renderNav();
    }

    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      loginError.textContent = "";
      try {
        await req("/api/login", { method: "POST", body: JSON.stringify({ password: adminPassword.value }) });
        showApp();
        await loadAll();
      } catch (err) {
        loginError.textContent = err.message;
      }
    });
    logout.onclick = async () => { await req("/api/logout", { method: "POST" }); location.reload(); };
    refresh.onclick = async () => {
      const original = refresh.textContent;
      refresh.disabled = true;
      refresh.textContent = "↻ Refreshing...";
      try { await loadAll(); } catch (err) { alert(err.message); }
      refresh.disabled = false;
      refresh.textContent = original;
    };

    function renderNav() {
      nav.innerHTML = tabs.map(([id, label]) => '<button class="' + (state.tab === id ? "active" : "") + '" data-tab="' + id + '">' + label + '</button>').join("");
      nav.querySelectorAll("button").forEach(btn => btn.onclick = () => setTab(btn.dataset.tab));
    }

    function setTab(tab) {
      state.tab = tab;
      title.textContent = tabs.find(t => t[0] === tab)[1];
      document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === tab));
      renderNav();
      render();
    }

    async function loadAll() {
      try {
        const [summary, users, categories, products, orders, coupons, messages, gallery, fulfillment] = await Promise.all([
          req("/api/summary"), req("/api/users"), req("/api/categories"), req("/api/products"),
          req("/api/orders"), req("/api/coupons"), req("/api/messages"), req("/api/gallery"), req("/api/fulfillment")
        ]);
        Object.assign(state, summary, users, categories, products, orders, coupons, messages, fulfillment, { gallery: gallery.images });
        showApp();
        render();
        const stamp = document.getElementById("updatedAt");
        if (stamp) stamp.innerHTML = '<span class="pill live">● Live · updated ' + new Date().toLocaleTimeString() + '</span>';
      } catch (err) {
        login.style.display = "grid";
        app.style.display = "none";
        loginError.textContent = err.message || "";
      }
    }

    function render() {
      renderDashboard(); renderUsers(); renderProducts(); renderCategories(); renderOrders(); renderFulfillment(); renderCoupons(); renderMessages();
    }

    function renderDashboard() {
      const c = state.counts || {};
      const s = state.ordersByStatus || { paid: 0, pending: 0, failed: 0 };
      const live = state.liveUsers || [];
      dashboard.innerHTML =
        healthBanner() +
        '<div class="grid" style="margin-top:14px">' +
          card("Live people (signed in)", live.length, "Active sessions right now", "👥", "#10b981") +
          card("New users (24h)", c.usersLast24h ?? 0, "Total users: " + (c.users ?? 0), "🧑", "#4f39f6") +
          card("New orders (24h)", c.ordersLast24h ?? 0, "Total orders: " + (c.orders ?? 0), "🛒", "#d97706") +
          card("Paid revenue", money(c.paidRevenue ?? 0), "Pending: " + money(c.pendingRevenue ?? 0), "💰", "#0ea5e9") +
        '</div>' +
        '<h3 style="margin:20px 0 10px">Orders by status</h3>' +
        '<div class="cols" style="align-items:start">' +
          '<div class="stack">' +
            card("Paid orders", s.paid, "Completed & collected", "✅", "#10b981") +
            card("Pending orders", s.pending, "Uncollected: " + money(c.pendingRevenue ?? 0), "⏳", "#d97706") +
            card("Failed orders", s.failed, "Did not complete", "❌", "#dc2626") +
          '</div>' +
          '<div class="card"><h3>Database contents</h3>' + countsTable(c) + '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:14px"><h3>Live people — active sessions</h3>' +
          (live.length
            ? '<table><thead><tr><th>User</th><th>Signed in</th><th>Session expires</th></tr></thead><tbody>' +
              live.map(u => '<tr><td><div class="user-cell">' + avatarHtml(u.image, u.name || u.email) + '<div><strong>' + esc(u.name || "No name") + '</strong><br><span class="muted">' + esc(u.email) + '</span></div></div></td><td>' + date(u.signedInAt) + '</td><td>' + date(u.expiresAt) + '</td></tr>').join("") +
              '</tbody></table>'
            : '<p class="muted">No one is signed in right now.</p>') +
        '</div>' +
        '<div class="cols" style="margin-top:14px">' +
          '<div class="card"><h3>Recent orders</h3>' + list((state.recentOrders || []).map(o => "#" + o.id.slice(-8).toUpperCase() + " - " + o.email + " - " + money(o.total) + " - " + o.status)) + '</div>' +
          '<div class="card"><h3>Recent users</h3>' + list((state.recentUsers || []).map(u => (u.name || "No name") + " - " + u.email)) + '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:14px"><h3>Recent messages</h3>' + list((state.recentMessages || []).map(m => (m.email || "?") + " - " + (m.subject || "(no subject)"))) + '</div>';
    }

    function healthBanner() {
      const h = state.health;
      if (!h) return '';
      const ok = h.ok;
      const bg = ok ? "#e9f9ef" : "#fdeaea";
      const border = ok ? "var(--good)" : "var(--danger)";
      const dot = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + border + ';margin-right:8px;vertical-align:middle"></span>';
      const detail = ok
        ? 'Connected to <strong>' + esc(h.database || "database") + '</strong> (' + esc(h.provider || "") + ') · responded in ' + (h.responseMs ?? "?") + ' ms'
        : 'Cannot reach the database: ' + esc(h.error || "unknown error");
      return '<div class="card" style="background:' + bg + ';border-left:4px solid ' + border + '">' + dot +
        '<strong>' + (ok ? "Database is working" : "Database problem") + '</strong><br><span class="muted">' + detail + ' · checked ' + date(h.checkedAt) + '</span></div>';
    }


    function countsTable(c) {
      const rows = [
        ["Users", c.users], ["Products", c.products], ["Categories", c.categories],
        ["Orders", c.orders], ["Coupons", c.coupons], ["Support messages", c.messages],
        ["Wishlist items", c.wishlist], ["Addresses", c.addresses],
        ["Sessions (total)", c.sessions], ["Active sessions", c.activeSessions],
      ];
      return '<table><tbody>' + rows.map(r => '<tr><td>' + r[0] + '</td><td style="text-align:right"><strong>' + (r[1] ?? 0) + '</strong></td></tr>').join("") + '</tbody></table>';
    }

    function card(label, value, sub, icon, accent) {
      const chip = icon ? '<div class="stat-ic" style="--c:' + (accent || "var(--accent)") + '">' + icon + '</div>' : '';
      return '<div class="card' + (icon ? " stat" : "") + '">' + chip + '<div class="stat-body"><div class="muted">' + label + '</div><div class="metric">' + value + '</div>' + (sub ? '<div class="muted small" style="margin-top:4px">' + esc(sub) + '</div>' : '') + '</div></div>';
    }
    function list(items) { return items.length ? '<ul>' + items.map(i => '<li>' + esc(i) + '</li>').join("") + '</ul>' : '<p class="muted">No data yet.</p>'; }

    function renderUsers() {
      users.innerHTML = '<div class="toolbar"><h2>Users</h2><button class="ghost" onclick="loadAll()">Refresh</button></div>' +
        '<table><thead><tr><th>User</th><th>Info</th><th>Activity</th><th>Actions</th></tr></thead><tbody>' +
        state.users.map(u => '<tr><td><div class="user-cell">' + avatarHtml(u.image, u.name || u.email) + '<div><strong>' + esc(u.name || "No name") + '</strong><br><span class="muted">' + esc(u.email) + '</span></div></div></td>' +
        '<td>' + esc(u.country || "-") + '<br><span class="pill">' + (u.google ? "Google" : "Email") + '</span> <span class="pill">' + (u.hasPassword ? "Password set" : "No password") + '</span></td>' +
        '<td>Orders: ' + u.counts.orders + '<br>Messages: ' + u.counts.messages + '<br>Wishlist: ' + u.counts.wishlist + '</td>' +
        '<td><button class="ghost" onclick="viewUser(\\'' + u.id + '\\')">Details</button> <button class="ghost" onclick="editUser(\\'' + u.id + '\\')">Edit</button> <button class="ghost" onclick="changePassword(\\'' + u.id + '\\')">Change password</button></td></tr>').join("") +
        '</tbody></table>';
    }

    function renderProducts() {
      products.innerHTML = '<div class="toolbar"><h2>Products</h2><button class="primary" onclick="editProduct()">Add product</button></div>' +
        '<table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>' +
        state.products.map(p => '<tr><td><div class="product-cell" style="cursor:pointer" onclick="editProduct(\\'' + p.id + '\\')" title="Click to edit">' + productImageHtml(p.image, p.name, "product-thumb") + '<div><strong>' + esc(p.name) + '</strong><br><span class="muted">' + esc(p.slug) + '</span></div></div></td><td>' + esc(p.category) + '</td>' +
        '<td>' + money(p.price) + '<br><span class="muted">Before: ' + money(p.compareAt) + ' / ' + p.reduction + '% off</span></td>' +
        '<td>' + p.stock + (p.featured ? '<br><span class="pill">Featured</span>' : '') + '</td><td><button class="ghost" onclick="editProduct(\\'' + p.id + '\\')">Edit</button> <button class="ghost danger" onclick="deleteProduct(\\'' + p.id + '\\')">Delete</button></td></tr>').join("") +
        '</tbody></table>';
    }

    function renderCategories() {
      categories.innerHTML = '<div class="toolbar"><h2>Categories</h2><button class="primary" onclick="editCategory()">Add category</button></div>' +
        '<table><thead><tr><th>Name</th><th>Slug</th><th>Products</th><th>Actions</th></tr></thead><tbody>' +
        state.categories.map(c => '<tr><td style="cursor:pointer" onclick="editCategory(\\'' + c.id + '\\')" title="Click to edit"><strong>' + esc(c.name) + '</strong></td><td>' + esc(c.slug) + '</td><td>' + c._count.products + '</td><td><button class="ghost" onclick="editCategory(\\'' + c.id + '\\')">Edit</button> <button class="ghost danger" onclick="deleteCategory(\\'' + c.id + '\\')">Delete</button></td></tr>').join("") +
        '</tbody></table>';
    }

    function renderOrders() {
      orders.innerHTML = '<div class="toolbar"><h2>Orders</h2><button class="primary" onclick="editOrder()">Add order</button></div>' +
        '<table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Items</th><th>Actions</th></tr></thead><tbody>' +
        state.orders.map(o => '<tr><td style="cursor:pointer" onclick="editOrder(\\'' + o.id + '\\')" title="Click to edit"><strong>#' + o.id.slice(-8).toUpperCase() + '</strong><br><span class="' + esc(o.status) + '">' + esc(o.status) + '</span><br><span class="muted">' + date(o.createdAt) + '</span></td>' +
        '<td>' + esc(o.email) + '<br><span class="muted">' + esc(o.user || "guest/manual") + '</span></td><td>' + money(o.total) + '<br><span class="muted">Discount: ' + money(o.discount) + '</span></td>' +
        '<td>' + o.items.map(i => esc(i.name) + " x " + i.quantity).join("<br>") + '</td><td><button class="ghost" onclick="viewPayment(\\'' + o.id + '\\')">Payment</button> <button class="ghost" onclick="editOrder(\\'' + o.id + '\\')">Edit</button> <button class="ghost danger" onclick="deleteOrder(\\'' + o.id + '\\')">Delete</button></td></tr>').join("") +
        '</tbody></table>';
    }

    const fulfillStep = { awaiting: "f-await", ordered: "f-order", shipped: "f-ship", delivered: "f-done" };
    function shipAddr(s) {
      if (!s || !s.line1) return '<span class="muted">No address</span>';
      return esc(s.name || "") + '<br><span class="muted">' + esc(s.phone || "") + '<br>' + esc(s.line1) + ', ' + esc(s.city || "") + (s.region ? ", " + esc(s.region) : "") + '</span>';
    }
    function renderFulfillment() {
      const t = state.fulfillmentTotals || {};
      const rows = state.fulfillment || [];
      const totals = '<div class="grid" style="margin-bottom:16px">' +
        card("Orders to fulfill", t.orders ?? 0, "Paid & needing shipping", "📦", "#4f39f6") +
        card("Revenue", money(t.revenue ?? 0), "From these orders", "💰", "#0ea5e9") +
        card("Supplier cost", money(t.supplierCost ?? 0), "What you paid suppliers", "🏷️", "#d97706") +
        card("Profit", money(t.profit ?? 0), "Revenue − supplier cost", "📈", "#10b981") +
        '</div>';
      const legend = '<div class="row" style="margin-bottom:12px">' +
        '<span class="pill f-await">Awaiting: ' + (t.awaiting ?? 0) + '</span>' +
        '<span class="pill f-order">Ordered: ' + (t.ordered ?? 0) + '</span>' +
        '<span class="pill f-ship">Shipped: ' + (t.shipped ?? 0) + '</span>' +
        '<span class="pill f-done">Delivered: ' + (t.delivered ?? 0) + '</span></div>';
      const table = rows.length
        ? '<table><thead><tr><th>Order</th><th>Ship to (Agadir)</th><th>Items</th><th>Supplier order</th><th>Tracking</th><th>Profit</th><th>Stage</th><th></th></tr></thead><tbody>' +
          rows.map(r => '<tr><td><strong>#' + r.id.slice(-8).toUpperCase() + '</strong><br><span class="muted">' + esc(r.email) + '</span>' + (r.status === "refunded" ? '<br><span class="pill refunded">refunded</span>' : '') + '</td>' +
          '<td>' + shipAddr(r.ship) + '</td>' +
          '<td>' + r.items.map(i => esc(i.name) + " x " + i.quantity).join("<br>") + '</td>' +
          '<td>' + (r.supplier ? '<strong>' + esc(r.supplier) + '</strong><br>' : '') + '<span class="muted">' + esc(r.supplierOrderId || "—") + '</span><br><span class="muted small">cost ' + money(r.supplierCost) + '</span></td>' +
          '<td>' + (r.trackingNumber ? esc(r.trackingNumber) + (r.carrier ? '<br><span class="muted">' + esc(r.carrier) + '</span>' : '') : '<span class="muted">—</span>') + (r.currentLocation ? '<br><span class="pill f-ship" style="margin-top:4px">📍 ' + esc(r.currentLocation) + '</span>' : '') + '</td>' +
          '<td><strong>' + money(r.profit) + '</strong></td>' +
          '<td><span class="pill ' + (fulfillStep[r.fulfillmentStatus] || "") + '">' + esc(r.fulfillmentStatus) + '</span></td>' +
          '<td><button class="ghost" onclick="editFulfillment(\\'' + r.id + '\\')">Manage</button></td></tr>').join("") +
          '</tbody></table>'
        : '<p class="muted">No paid orders to fulfill yet.</p>';
      fulfillment.innerHTML = '<div class="toolbar"><h2>Fulfillment</h2><button class="ghost" onclick="loadAll()">↻ Refresh</button></div>' + totals + legend + table;
    }

    function renderCoupons() {
      coupons.innerHTML = '<div class="toolbar"><h2>Coupons</h2><button class="primary" onclick="editCoupon()">Add coupon</button></div>' +
        '<table><thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        state.coupons.map(c => '<tr><td style="cursor:pointer" onclick="editCoupon(\\'' + c.id + '\\')" title="Click to edit"><strong>' + esc(c.code) + '</strong><br><span class="muted">' + esc(c.description) + '</span></td><td>' + (c.kind === "fixed" ? money(c.value / 100) : c.value + "%") + '</td><td>' + money(c.minSubtotal) + '</td><td>' + (c.active ? "Active" : "Inactive") + '</td><td><button class="ghost" onclick="editCoupon(\\'' + c.id + '\\')">Edit</button> <button class="ghost danger" onclick="deleteCoupon(\\'' + c.id + '\\')">Delete</button></td></tr>').join("") +
        '</tbody></table>';
    }

    function renderMessages() {
      messages.innerHTML = '<div class="toolbar"><h2>Messages</h2><button class="ghost" onclick="loadAll()">Refresh</button></div>' +
        '<table><thead><tr><th>From</th><th>Subject</th><th>Message</th><th>Date</th></tr></thead><tbody>' +
        state.messages.map(m => '<tr><td>' + esc(m.user) + '</td><td><strong>' + esc(m.subject) + '</strong></td><td class="message">' + esc(m.body) + '</td><td>' + date(m.createdAt) + '</td></tr>').join("") +
        '</tbody></table>';
    }

    function openModal(name, content) { modalTitle.textContent = name; modalBody.innerHTML = content; modal.showModal(); }
    function formValue(form, name) { const el = form.elements[name]; return el.type === "checkbox" ? el.checked : el.value; }
    function avatarHtml(src, label) {
      return src ? '<img class="avatar" src="' + esc(src) + '" alt="">' : '<span class="avatar">' + esc(String(label || "?").charAt(0).toUpperCase()) + '</span>';
    }
    function productImageHtml(src, label, className) {
      return src ? '<img class="' + className + '" src="' + esc(src) + '" alt="' + esc(label || "Product") + '" loading="lazy" onerror="this.style.visibility=\\'hidden\\'">' : '<span class="' + className + '"></span>';
    }
    function parseImages(value) {
      try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    function updateImagePreview(id, value) {
      const img = document.getElementById(id);
      if (img) img.src = value || "/products/1-1.avif";
    }
    async function uploadImageFile(file) {
      if (!file) return "";
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!state.gallery.includes(data.path)) state.gallery.unshift(data.path);
      return data.path;
    }
    async function uploadMainImage(file) {
      try {
        const imagePath = await uploadImageFile(file);
        if (!imagePath) return;
        prodForm.elements.image.value = imagePath;
        updateImagePreview("mainImagePreview", imagePath);
      } catch (err) {
        alert(err.message);
      }
    }
    async function uploadExtraImage(file) {
      try {
        const imagePath = await uploadImageFile(file);
        if (imagePath) addImageRow(imagePath);
      } catch (err) {
        alert(err.message);
      }
    }
    function galleryOptions() {
      return state.gallery.map(img => '<option value="' + esc(img) + '">' + esc(img) + '</option>').join("");
    }
    function useGalleryAsMain() {
      const select = document.getElementById("productGallerySelect");
      if (!select?.value) return;
      prodForm.elements.image.value = select.value;
      updateImagePreview("mainImagePreview", select.value);
    }
    function addGalleryImage() {
      const select = document.getElementById("productGallerySelect");
      if (select?.value) addImageRow(select.value);
    }
    function imageRowHtml(value = "") {
      const safeValue = esc(value);
      return '<div class="image-row"><img src="' + safeValue + '" alt="" onerror="this.style.visibility=\\'hidden\\'" onload="this.style.visibility=\\'visible\\'"><input name="extraImage" value="' + safeValue + '" placeholder="/products/1-2.avif or https://..." oninput="const img=this.parentElement.querySelector(\\'img\\'); img.style.visibility=\\'visible\\'; img.src=this.value"><button type="button" class="ghost danger" onclick="this.closest(\\'.image-row\\').remove()">Remove</button></div>';
    }
    function imageManagerHtml(mainImage, extraImages, label) {
      return '<div class="detail-box image-manager"><h4>Product image</h4><img id="mainImagePreview" class="product-preview" src="' + esc(mainImage || "/products/1-1.avif") + '" alt="' + esc(label || "Product") + '"><label>Main image path<input name="image" value="' + esc(mainImage || "/products/1-1.avif") + '" placeholder="/products/1-1.avif or https://..." oninput="updateImagePreview(\\'mainImagePreview\\', this.value)"></label><label>Upload main image<input type="file" accept="image/*" onchange="uploadMainImage(this.files[0]); this.value=\\'\\'"></label><div class="form-grid"><label class="full">Pick from gallery<select id="productGallerySelect"><option value="">Choose existing image</option>' + galleryOptions() + '</select></label><button type="button" class="ghost" onclick="useGalleryAsMain()">Use as main</button><button type="button" class="ghost" onclick="addGalleryImage()">Add to extras</button></div><div class="image-actions"><strong>Extra images</strong><div class="row"><button type="button" class="ghost" onclick="addImageRow()">Add empty row</button><label class="ghost" style="display:inline-flex;align-items:center;gap:6px">Upload image<input type="file" accept="image/*" style="display:none" onchange="uploadExtraImage(this.files[0]); this.value=\\'\\'"></label></div></div><div id="extraImagesRows" class="stack">' + extraImages.map(img => imageRowHtml(img)).join("") + '</div><p class="muted small">Upload from your files, pick from gallery, edit a path to replace, or remove an image row.</p></div>';
    }
    function addImageRow(value = "") {
      extraImagesRows.insertAdjacentHTML("beforeend", imageRowHtml(value));
    }
    function collectExtraImages() {
      return Array.from(prodForm.querySelectorAll('input[name="extraImage"]'))
        .map(input => input.value.trim())
        .filter(Boolean);
    }
    function detailList(items, empty, renderItem) {
      return items?.length ? '<div class="stack">' + items.map(renderItem).join("") + '</div>' : '<p class="muted">' + empty + '</p>';
    }
    function googleTokenBox(u) {
      if (!u.google) return '<div class="detail-box"><h4>Google tokens</h4><p class="muted">Not a Google-linked account.</p></div>';
      const token = u.googleAccessToken;
      const expiry = u.googleTokenExpiry
        ? date(u.googleTokenExpiry) + (u.tokenExpired ? ' <span class="pill failed">Expired</span>' : ' <span class="pill paid">Valid</span>')
        : "-";
      const tokenBlock = token
        ? '<textarea readonly rows="3" style="width:100%;font-family:monospace;font-size:12px" onclick="this.select()">' + esc(token) + '</textarea><button type="button" class="ghost small" style="margin-top:6px" onclick="navigator.clipboard.writeText(' + JSON.stringify(token) + ');this.textContent=\\'Copied\\'">Copy access token</button>'
        : '<p class="muted">No access token stored yet. It is saved the next time this user signs in with Google.</p>';
      return '<div class="detail-box"><h4>Google tokens</h4>' + tokenBlock +
        '<p style="margin-top:8px">Expires: ' + expiry + '<br>Refresh token: ' + (u.hasRefreshToken ? "Stored" : "None") + '</p></div>';
    }
    async function destroyRow(label, path) {
      if (!confirm("Delete this " + label + "?")) return;
      try {
        await req(path, { method: "DELETE" });
        await loadAll();
      } catch (err) {
        alert(err.message);
      }
    }

    window.viewUser = async id => {
      try {
        const data = await req("/api/users/" + id);
        const u = data.user;
        openModal("User details", '<div class="stack">' +
          '<div class="user-cell">' + avatarHtml(u.image, u.name || u.email) + '<div><h3 style="margin:0">' + esc(u.name || "No name") + '</h3><div class="muted">' + esc(u.email) + '</div></div></div>' +
          '<div class="detail-grid">' +
            '<div class="detail-box"><h4>Account</h4><p>ID: ' + esc(u.id) + '<br>Country: ' + esc(u.country || "-") + '<br>Payment: ' + esc(u.preferredPayment || "-") + '<br>Google: ' + (u.google ? "Yes" : "No") + '<br>Google ID: ' + esc(u.googleIdPreview || "-") + '<br>Password: ' + (u.hasPassword ? "Set" : "Not set") + '<br>Created: ' + date(u.createdAt) + '<br>Updated: ' + date(u.updatedAt) + '</p></div>' +
            googleTokenBox(u) +
            '<div class="detail-box"><h4>Sessions</h4>' + detailList(u.sessions, "No active sessions.", s => '<div><strong>' + esc(s.expired ? "Expired" : "Active") + '</strong><br><span class="muted">Token: ' + esc(s.tokenPreview) + '<br>Created: ' + date(s.createdAt) + '<br>Expires: ' + date(s.expiresAt) + '</span></div>') + '</div>' +
            '<div class="detail-box"><h4>Addresses</h4>' + detailList(u.addresses, "No addresses.", a => '<div><strong>' + esc(a.fullName) + (a.isDefault ? ' <span class="pill">Default</span>' : '') + '</strong><br><span class="muted">' + esc(a.phone) + '<br>' + esc(a.line1) + ', ' + esc(a.city) + ' ' + esc(a.region || "") + '</span></div>') + '</div>' +
            '<div class="detail-box"><h4>Wishlist</h4>' + detailList(u.wishlist, "Wishlist is empty.", w => '<div class="user-cell">' + avatarHtml(w.product.image, w.product.name) + '<div><strong>' + esc(w.product.name) + '</strong><br><span class="muted">' + money(w.product.price) + ' / ' + esc(w.product.slug) + '</span></div></div>') + '</div>' +
            '<div class="detail-box"><h4>Orders</h4>' + detailList(u.orders, "No orders.", o => '<div><strong>#' + esc(o.id.slice(-8).toUpperCase()) + ' - ' + esc(o.status) + '</strong><br><span class="muted">' + money(o.total) + ' / Discount ' + money(o.discount) + '<br>' + o.items.map(i => esc(i.name) + " x " + i.quantity).join("<br>") + '</span></div>') + '</div>' +
            '<div class="detail-box"><h4>Messages</h4>' + detailList(u.messages, "No messages.", m => '<div><strong>' + esc(m.subject) + '</strong><br><span class="muted">' + date(m.createdAt) + '</span><p class="message">' + esc(m.body) + '</p></div>') + '</div>' +
          '</div></div>');
      } catch (err) {
        alert(err.message);
      }
    };

    window.editUser = id => {
      const u = state.users.find(x => x.id === id);
      openModal("Edit user", '<form id="userForm"><label>Name<input name="name" value="' + esc(u.name || "") + '"></label><label>Country<input name="country" value="' + esc(u.country || "") + '"></label><label>Preferred payment<select name="preferredPayment"><option value="">None</option><option value="card">Card</option><option value="cod">Cash on delivery</option></select></label><div class="actions"><button class="primary">Save</button></div></form>');
      userForm.elements.preferredPayment.value = u.preferredPayment || "";
      userForm.onsubmit = async e => { e.preventDefault(); try { await req("/api/users/" + id, { method:"PATCH", body: JSON.stringify({ name: formValue(userForm,"name"), country: formValue(userForm,"country"), preferredPayment: formValue(userForm,"preferredPayment") }) }); modal.close(); await loadAll(); } catch (err) { alert(err.message); } };
    };

    window.changePassword = id => {
      openModal("Change user password", '<form id="passForm"><label>New password<input name="password" type="password" minlength="8" required></label><div class="actions"><button class="primary">Change password</button></div></form>');
      passForm.onsubmit = async e => { e.preventDefault(); try { await req("/api/users/" + id + "/password", { method:"POST", body: JSON.stringify({ password: formValue(passForm,"password") }) }); modal.close(); alert("Password changed."); await loadAll(); } catch (err) { alert(err.message); } };
    };

    window.editCategory = id => {
      const c = id ? state.categories.find(x => x.id === id) : {};
      openModal(id ? "Edit category" : "Add category", '<form id="catForm"><label>Name<input name="name" value="' + esc(c.name || "") + '" required></label><label>Slug<input name="slug" value="' + esc(c.slug || "") + '"></label><div class="actions"><button class="primary">Save</button></div></form>');
      catForm.onsubmit = async e => { e.preventDefault(); try { await req(id ? "/api/categories/" + id : "/api/categories", { method: id ? "PATCH" : "POST", body: JSON.stringify({ name: formValue(catForm,"name"), slug: formValue(catForm,"slug") }) }); modal.close(); await loadAll(); } catch (err) { alert(err.message); } };
    };

    window.editProduct = id => {
      const p = id ? state.products.find(x => x.id === id) : { currency:"mad", rating:4.5, reviews:0, stock:100, images:"[]" };
      const extraImages = parseImages(p.images);
      openModal(id ? "Edit product" : "Add product", '<form id="prodForm">' + imageManagerHtml(p.image || "/products/1-1.avif", extraImages, p.name) + '<div class="form-grid">' +
      '<label>Name<input name="name" value="' + esc(p.name || "") + '" required></label><label>Slug<input name="slug" value="' + esc(p.slug || "") + '"></label>' +
      '<label>Category<select name="categoryId" required>' + state.categories.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join("") + '</select></label><label>Badge<input name="badge" value="' + esc(p.badge || "") + '"></label>' +
      '<label>Price DH<input name="price" type="number" step="0.01" value="' + esc(p.price || 0) + '" required></label><label>Before price DH<input name="compareAt" type="number" step="0.01" value="' + esc(p.compareAt || "") + '"></label>' +
      '<label>Currency<input name="currency" value="' + esc(p.currency || "mad") + '"></label><label>Stock<input name="stock" type="number" value="' + esc(p.stock ?? 100) + '"></label>' +
      '<label>Rating<input name="rating" type="number" step="0.1" value="' + esc(p.rating || 4.5) + '"></label><label>Reviews<input name="reviews" type="number" value="' + esc(p.reviews || 0) + '"></label>' +
      '<label class="full">Description<textarea name="description">' + esc(p.description || "") + '</textarea></label><label><input name="featured" type="checkbox"> Featured product</label></div><div class="actions"><button class="primary">Save</button></div></form>');
      prodForm.elements.categoryId.value = p.categoryId || state.categories[0]?.id || "";
      prodForm.elements.featured.checked = Boolean(p.featured);
      prodForm.onsubmit = async e => { e.preventDefault(); const body = {}; ["name","slug","categoryId","badge","price","compareAt","currency","stock","rating","reviews","image","description","featured"].forEach(k => body[k] = formValue(prodForm,k)); body.images = JSON.stringify(collectExtraImages()); try { await req(id ? "/api/products/" + id : "/api/products", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) }); modal.close(); await loadAll(); } catch (err) { alert(err.message); } };
    };

    window.editOrder = id => {
      const o = id ? state.orders.find(x => x.id === id) : { status:"pending", currency:"mad", items:[] };
      const options = selected => '<option value="">None</option>' + state.products.map(p => '<option value="' + p.id + '"' + (p.id === selected ? " selected" : "") + '>' + esc(p.name) + " - " + money(p.price) + '</option>').join("");
      const itemRows = [0,1,2,3].map(i => {
        const item = o.items?.[i] || {};
        return '<label>Product ' + (i + 1) + '<select name="product' + i + '">' + options(item.productId || "") + '</select></label><label>Quantity<input name="qty' + i + '" type="number" min="1" value="' + esc(item.quantity || (i === 0 ? 1 : "")) + '"></label>';
      }).join("");
      openModal(id ? "Edit order" : "Add order", '<form id="orderForm"><div class="form-grid"><label>Email<input name="email" value="' + esc(o.email || "") + '" required></label><label>User<select name="userId"><option value="">Guest/manual</option>' + state.users.map(u => '<option value="' + u.id + '">' + esc(u.email) + '</option>').join("") + '</select></label><label>Status<select name="status"><option>pending</option><option>paid</option><option>failed</option><option>cancelled</option><option>refunded</option></select></label><label>Currency<input name="currency" value="' + esc(o.currency || "mad") + '"></label><label>Discount DH<input name="discount" type="number" step="0.01" value="' + esc(o.discount || 0) + '"></label><label>Coupon<input name="couponCode" value="' + esc(o.couponCode || "") + '"></label></div><div class="card"><strong>Items</strong><div class="form-grid" style="margin-top:10px">' + itemRows + '</div><p class="muted small">Prices are taken from the selected products when you save.</p></div><div class="actions"><button class="primary">Save</button></div></form>');
      orderForm.elements.status.value = o.status || "pending";
      orderForm.elements.userId.value = o.userId || "";
      orderForm.onsubmit = async e => {
        e.preventDefault();
        const items = [0,1,2,3].map(i => ({ productId: formValue(orderForm,"product" + i), quantity: formValue(orderForm,"qty" + i) })).filter(i => i.productId);
        const body = { email: formValue(orderForm,"email"), userId: formValue(orderForm,"userId"), status: formValue(orderForm,"status"), currency: formValue(orderForm,"currency"), discount: formValue(orderForm,"discount"), couponCode: formValue(orderForm,"couponCode"), items };
        try {
          await req(id ? "/api/orders/" + id : "/api/orders", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
          modal.close();
          await loadAll();
        } catch (err) {
          alert(err.message);
        }
      };
    };

    window.editCoupon = id => {
      const c = id ? state.coupons.find(x => x.id === id) : { kind:"percent", active:true };
      openModal(id ? "Edit coupon" : "Add coupon", '<form id="couponForm"><div class="form-grid"><label>Code<input name="code" value="' + esc(c.code || "") + '" required></label><label>Kind<select name="kind"><option value="percent">Percent</option><option value="fixed">Fixed DH</option></select></label><label>Value<input name="value" type="number" step="0.01" value="' + esc(c.kind === "fixed" ? (c.value || 0) / 100 : c.value || 0) + '"></label><label>Minimum subtotal DH<input name="minSubtotal" type="number" step="0.01" value="' + esc(c.minSubtotal || 0) + '"></label><label class="full">Description<input name="description" value="' + esc(c.description || "") + '"></label><label><input name="active" type="checkbox"> Active</label></div><div class="actions"><button class="primary">Save</button></div></form>');
      couponForm.elements.kind.value = c.kind || "percent"; couponForm.elements.active.checked = c.active !== false;
      couponForm.onsubmit = async e => { e.preventDefault(); try { await req(id ? "/api/coupons/" + id : "/api/coupons", { method: id ? "PATCH" : "POST", body: JSON.stringify({ code: formValue(couponForm,"code"), description: formValue(couponForm,"description"), kind: formValue(couponForm,"kind"), value: formValue(couponForm,"value"), minSubtotal: formValue(couponForm,"minSubtotal"), active: formValue(couponForm,"active") }) }); modal.close(); await loadAll(); } catch (err) { alert(err.message); } };
    };

    const eventMeta = {
      created: { cls: "", label: "Order created (pending)" },
      tokenized: { cls: "", label: "Payment token created" },
      confirm_paid: { cls: "warn", label: "Browser confirmed (instant)" },
      webhook_paid: { cls: "ok", label: "Webhook: payment confirmed" },
      prepay_submitted: { cls: "warn", label: "Customer sent transfer reference" },
      manual_paid: { cls: "ok", label: "Payment confirmed manually" },
      received: { cls: "ok", label: "Customer confirmed delivery" },
      refund_requested: { cls: "warn", label: "Customer requested a refund" },
      cancelled: { cls: "bad", label: "Order cancelled by customer" },
      refund_status: { cls: "warn", label: "Refund status updated" },
      failed: { cls: "bad", label: "Payment failed" },
      refunded: { cls: "refund", label: "Refunded" },
      refund_status: { cls: "refund", label: "Refund stage updated" },
    };

    window.viewPayment = async id => {
      try {
        const data = await req("/api/orders/" + id + "/payment");
        renderPaymentModal(data.payment);
      } catch (err) {
        alert(err.message);
      }
    };

    function renderPaymentModal(p) {
      const timeline = p.events.length
        ? '<div class="timeline">' + p.events.map(e => {
            const m = eventMeta[e.type] || { cls: "", label: e.type };
            return '<div class="tl ' + m.cls + '"><h5>' + esc(m.label) + (e.amount != null ? ' · ' + money(e.amount) : '') + '</h5><div class="when">' + date(e.createdAt) + (e.provider ? ' · ' + esc(e.provider) : '') + '</div>' + (e.message ? '<p>' + esc(e.message) + '</p>' : '') + '</div>';
          }).join("") + '</div>'
        : '<p class="muted">No payment events recorded yet. (Orders placed before payment tracking was added have no history.)</p>';

      const details = '<div class="detail-box"><h4>Payment details</h4><div class="kv">' +
        '<b>Status</b><span class="' + esc(p.status) + '"><strong>' + esc(p.status) + '</strong></span>' +
        '<b>Method</b><span>' + esc(p.paymentMethod || "card") + (p.paymentMethod === "prepaid" ? " (bank/CashPlus transfer)" : "") + '</span>' +
        (p.paymentRef ? '<b>Transfer ref</b><span class="mono">' + esc(p.paymentRef) + '</span>' : '') +
        (p.receiptUrl
          ? '<b>Receipt</b><span><a href="' + esc(p.receiptUrl) + '" target="_blank" rel="noopener"><img src="' + esc(p.receiptUrl) + '" alt="receipt" style="max-width:160px;max-height:200px;border:1px solid var(--border);border-radius:8px;display:block;margin-bottom:4px" onerror="this.replaceWith(document.createTextNode(\\'Open receipt ↗\\'))"><span class="small">Open full size ↗</span></a></span>'
          : '') +
        '<b>Provider</b><span>' + esc(p.provider) + '</span>' +
        '<b>Customer</b><span>' + esc(p.email) + '</span>' +
        '<b>Amount</b><span>' + money(p.total) + '</span>' +
        '<b>Discount</b><span>' + money(p.discount) + '</span>' +
        (p.couponCode ? '<b>Coupon</b><span>' + esc(p.couponCode) + '</span>' : '') +
        '<b>Refunded</b><span>' + money(p.refunded) + (p.refundedAt ? ' · ' + date(p.refundedAt) : '') + '</span>' +
        (p.refundReason ? '<b>Refund reason</b><span>' + esc(p.refundReason) + '</span>' : '') +
        '<b>Transaction</b><span class="mono">' + esc(p.youcanTransactionId || p.stripeSessionId || "-") + '</span>' +
        '<b>Token</b><span class="mono">' + esc(p.youcanTokenId || "-") + '</span>' +
        '<b>Created</b><span>' + date(p.createdAt) + '</span>' +
        '</div></div>';

      // Cancellation & refund-status section
      const refundStages = ["requested", "reviewing", "processing", "sent"];
      const stageLabels = { requested: "Cancellation received", reviewing: "Checking payment", processing: "Sending refund", sent: "Refund sent", rejected: "Rejected" };
      const hasCancel = p.cancelReason || p.refundRib || (p.refundStatus && p.refundStatus !== "none");
      const cancelBox = hasCancel
        ? '<div class="detail-box"><h4>Cancellation & refund process</h4><div class="kv">' +
          (p.cancelReason ? '<b>Cancel reason</b><span>' + esc(p.cancelReason) + '</span>' : '') +
          (p.refundRib ? '<b>Customer RIB</b><span class="mono">' + esc(p.refundRib) + '</span>' : '') +
          '<b>Refund status</b><span class="' + (p.refundStatus === 'sent' ? 'paid' : p.refundStatus === 'rejected' ? 'failed' : 'pending') + '"><strong>' + esc(p.refundStatus || 'none') + '</strong></span>' +
          (p.refundStatusAt ? '<b>Last updated</b><span>' + date(p.refundStatusAt) + '</span>' : '') +
          (p.refundNote ? '<b>Admin note</b><span>' + esc(p.refundNote) + '</span>' : '') +
          '</div>' +
          (p.refundStatus && p.refundStatus !== 'none' && p.refundStatus !== 'sent' && p.refundStatus !== 'rejected'
            ? '<div style="margin-top:12px"><p class="muted small">Advance the refund stage so the customer can track their money coming back.</p>' +
              '<form id="refundStatusForm"><div class="form-grid">' +
              '<label>Next stage<select name="stage">' +
              refundStages.filter(function(s) { return refundStages.indexOf(s) > refundStages.indexOf(p.refundStatus); }).map(function(s) { return '<option value="' + s + '">' + esc(stageLabels[s]) + '</option>'; }).join('') +
              '<option value="rejected">\u274c Reject (no payment found)</option>' +
              '</select></label>' +
              '<label>Note (optional, shown to customer if rejected)<input name="note" placeholder="e.g. no transfer received"></label>' +
              '</div><div class="actions"><button class="primary">Advance refund</button></div></form></div>'
            : (p.refundStatus === 'sent' ? '<p class="paid" style="margin-top:8px">\u2713 Refund has been sent to the customer.</p>' : '') +
              (p.refundStatus === 'rejected' ? '<p class="failed" style="margin-top:8px">Refund was rejected.' + (p.refundNote ? ' \u2014 ' + esc(p.refundNote) : '') + '</p>' : '')) +
          '</div>'
        : '';

      const needsConfirm = p.status !== "paid" && p.status !== "refunded";
      const confirmBox = needsConfirm
        ? '<div class="detail-box"><h4>Confirm payment</h4>' +
          '<p class="muted small">' + (p.paymentMethod === "prepaid"
            ? 'Once you see the customer\\'s bank/CashPlus transfer arrive' + (p.paymentRef ? ' (ref: <strong>' + esc(p.paymentRef) + '</strong>)' : '') + ', confirm it here. This marks the order paid so you can order from the supplier and ship.'
            : 'Mark this order as paid once you have received the money.') + '</p>' +
          '<div class="actions"><button class="primary" id="confirmPayBtn">✓ Confirm payment received</button></div></div>'
        : '';

      const canRefund = p.status !== "refunded";
      const refundForm = '<div class="detail-box"><h4>Refund</h4>' +
        '<p class="muted small">This records the refund in your admin and marks the order. <strong>Issue the actual money-back to the customer</strong> (bank/CashPlus/gateway) — the app does not move money.</p>' +
        (canRefund
          ? '<form id="refundForm"><div class="form-grid"><label>Amount DH (blank = full ' + money(p.total) + ')<input name="amount" type="number" step="0.01" min="0" placeholder="' + esc(p.total) + '"></label><label>Reason<input name="reason" placeholder="e.g. customer request"></label></div><div class="actions"><button class="ghost danger">Record refund</button></div></form>'
          : '<p class="paid">Already fully refunded' + (p.refundedAt ? ' on ' + date(p.refundedAt) : '') + '.</p>') +
        '</div>';

      openModal("Payment · #" + p.id.slice(-8).toUpperCase(), '<div class="stack">' + details + cancelBox + confirmBox +
        '<div class="detail-box"><h4>Timeline — from checkout to paid</h4>' + timeline + '</div>' + refundForm + '</div>');

      if (needsConfirm) {
        const btn = document.getElementById("confirmPayBtn");
        if (btn) btn.onclick = async () => {
          if (!confirm("Mark this order as PAID? Do this only after the money has actually arrived.")) return;
          try {
            await req("/api/orders/" + p.id + "/confirm-payment", { method: "POST" });
            const fresh = await req("/api/orders/" + p.id + "/payment");
            renderPaymentModal(fresh.payment);
            await loadAll();
          } catch (err) {
            alert(err.message);
          }
        };
      }

      if (canRefund) {
        refundForm.onsubmit = async e => {
          e.preventDefault();
          if (!confirm("Record this refund? Remember to also issue it in the YouCan Pay dashboard.")) return;
          try {
            await req("/api/orders/" + p.id + "/refund", { method: "POST", body: JSON.stringify({ amount: formValue(refundForm, "amount"), reason: formValue(refundForm, "reason") }) });
            const fresh = await req("/api/orders/" + p.id + "/payment");
            renderPaymentModal(fresh.payment);
            await loadAll();
          } catch (err) {
            alert(err.message);
          }
        };
      }

      const rsForm = document.getElementById("refundStatusForm");
      if (rsForm) {
        rsForm.onsubmit = async e => {
          e.preventDefault();
          const stage = formValue(rsForm, "stage");
          const label = stage === "rejected" ? "reject this refund" : "advance the refund to " + stage;
          if (!confirm("Are you sure you want to " + label + "?")) return;
          try {
            await req("/api/orders/" + p.id + "/refund-status", { method: "POST", body: JSON.stringify({ stage: stage, note: formValue(rsForm, "note") }) });
            const fresh = await req("/api/orders/" + p.id + "/payment");
            renderPaymentModal(fresh.payment);
            await loadAll();
          } catch (err) {
            alert(err.message);
          }
        };
      }
    }

    window.editFulfillment = id => {
      const r = state.fulfillment.find(x => x.id === id);
      if (!r) return;
      const q = encodeURIComponent((r.items[0] && r.items[0].name) || "");
      const links = '<div class="row"><a class="ghost" target="_blank" rel="noopener" href="https://www.aliexpress.com/wholesale?SearchText=' + q + '">Find on AliExpress ↗</a><a class="ghost" target="_blank" rel="noopener" href="https://www.temu.com/search_result.html?search_key=' + q + '">Find on Temu ↗</a></div>';
      openModal("Fulfill order #" + r.id.slice(-8).toUpperCase(),
        '<div class="stack">' +
          '<div class="detail-box"><h4>Ship to (deliver in Agadir)</h4><p>' + shipAddr(r.ship) + '</p></div>' +
          '<div class="detail-box"><h4>Order from supplier</h4><p class="muted small">Paid ' + money(r.total) + ' by the customer. Order the product from your supplier, then record the details below.</p>' + links + '</div>' +
          '<form id="fulfillForm"><div class="form-grid">' +
            '<label>Supplier<select name="supplier"><option value="">Choose…</option><option value="aliexpress">AliExpress</option><option value="temu">Temu</option><option value="other">Other</option></select></label>' +
            '<label>Supplier order ID<input name="supplierOrderId" value="' + esc(r.supplierOrderId || "") + '" placeholder="e.g. 812345..."></label>' +
            '<label>Supplier cost DH<input name="supplierCost" type="number" step="0.01" value="' + esc(r.supplierCost || 0) + '"></label>' +
            '<label>Stage<select name="fulfillmentStatus"><option value="awaiting">Awaiting</option><option value="ordered">Ordered from supplier</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option></select></label>' +
            '<label>Carrier<input name="carrier" value="' + esc(r.carrier || "") + '" placeholder="e.g. Aramex, local"></label>' +
            '<label>Tracking number<input name="trackingNumber" value="' + esc(r.trackingNumber || "") + '"></label>' +
            '<label class="full">Current location (shown to the customer)<input name="currentLocation" value="' + esc(r.currentLocation || "") + '" placeholder="e.g. In transit — Casablanca hub / Out for delivery in Agadir"></label>' +
            (r.locationUpdatedAt ? '<p class="muted small full" style="margin-top:-6px">Location last updated ' + date(r.locationUpdatedAt) + '</p>' : '') +
            '<label class="full">Notes (private, admin only)<textarea name="fulfillmentNotes" placeholder="Anything to remember about this order">' + esc(r.fulfillmentNotes || "") + '</textarea></label>' +
          '</div><div class="actions"><button class="primary">Save fulfillment</button></div></form>' +
        '</div>');
      fulfillForm.elements.supplier.value = r.supplier || "";
      fulfillForm.elements.fulfillmentStatus.value = r.fulfillmentStatus || "awaiting";
      fulfillForm.onsubmit = async e => {
        e.preventDefault();
        const body = {};
        ["supplier", "supplierOrderId", "supplierCost", "fulfillmentStatus", "carrier", "trackingNumber", "currentLocation", "fulfillmentNotes"].forEach(k => body[k] = formValue(fulfillForm, k));
        try {
          await req("/api/orders/" + id + "/fulfillment", { method: "PATCH", body: JSON.stringify(body) });
          modal.close();
          await loadAll();
        } catch (err) {
          alert(err.message);
        }
      };
    };

    window.deleteProduct = id => destroyRow("product", "/api/products/" + id);
    window.deleteCategory = id => destroyRow("category", "/api/categories/" + id);
    window.deleteOrder = id => destroyRow("order", "/api/orders/" + id);
    window.deleteCoupon = id => destroyRow("coupon", "/api/coupons/" + id);

    loadAll();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const pathname = parseUrl(req.url || "/").pathname || "/";
  const startedAt = Date.now();
  res.on("finish", () => {
    // Skip static asset noise; log page + API requests with their status.
    if (pathname.startsWith("/products/") || pathname.startsWith("/receipts/")) return;
    console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (servePublicFile(res, pathname)) return;
    return html(res, page());
  } catch (err) {
    console.error(err);
    return fail(res, err instanceof Error ? err.message : "Unexpected admin error.", 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Admin panel listening on http://${HOST}:${PORT}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
