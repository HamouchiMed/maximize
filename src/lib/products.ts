import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type SortKey = "featured" | "price-asc" | "price-desc" | "newest" | "rating";

export interface ProductQuery {
  category?: string; // category slug
  search?: string;
  sort?: SortKey;
  minPrice?: number; // dollars
  maxPrice?: number; // dollars
}

function orderBy(sort: SortKey | undefined): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { priceCents: "asc" };
    case "price-desc":
      return { priceCents: "desc" };
    case "newest":
      return { createdAt: "desc" };
    case "rating":
      return { rating: "desc" };
    default:
      return { featured: "desc" };
  }
}

export async function getProducts(query: ProductQuery = {}) {
  const where: Prisma.ProductWhereInput = {};

  if (query.category) {
    where.category = { slug: query.category };
  }
  if (query.search) {
    where.name = { contains: query.search };
  }
  if (query.minPrice != null || query.maxPrice != null) {
    where.priceCents = {};
    if (query.minPrice != null) where.priceCents.gte = Math.round(query.minPrice * 100);
    if (query.maxPrice != null) where.priceCents.lte = Math.round(query.maxPrice * 100);
  }

  return prisma.product.findMany({
    where,
    orderBy: orderBy(query.sort),
    include: { category: true },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
}

export async function getFeaturedProducts(take = 8) {
  return prisma.product.findMany({
    where: { featured: true },
    orderBy: { rating: "desc" },
    take,
    include: { category: true },
  });
}

export async function getNewestProducts(take = 8) {
  return prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { category: true },
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export type ProductWithCategory = Awaited<ReturnType<typeof getProducts>>[number];
