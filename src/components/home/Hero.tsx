"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/format";

export interface HeroProduct {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
}

interface SlideConfig {
  id: "sale" | "home" | "clearance";
  variant: "cards" | "coupons";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta: string;
  href: string;
  bg: string;
  text: "dark" | "light";
  pill: string;
  decor?: string;
}

const SLIDES: SlideConfig[] = [
  {
    id: "sale",
    variant: "cards",
    eyebrow: "Mega Summer Sale",
    title: "Up to 60% off",
    subtitle: "Beat the heat with deals on everything — while stocks last.",
    cta: "Shop the sale",
    href: "/products?sort=price-asc",
    bg: "bg-gradient-to-b from-sky-300 to-sky-100",
    text: "dark",
    pill: "bg-orange-500 text-white",
    decor: "☀️",
  },
  {
    id: "home",
    variant: "cards",
    eyebrow: "Home Refresh",
    title: "Home upgrade",
    subtitle: "Boost your space for less.",
    cta: "Shop now",
    href: "/products?category=home",
    bg: "bg-gradient-to-b from-lime-100 to-[#eef1d8]",
    text: "dark",
    pill: "bg-emerald-600 text-white",
    decor: "🪴",
  },
  {
    id: "clearance",
    variant: "coupons",
    title: "Summer Clearance",
    subtitle: "Sale ends soon — stack coupons for extra savings.",
    cta: "Grab the deals",
    href: "/products?sort=price-asc",
    bg: "bg-gradient-to-br from-blue-600 to-blue-500",
    text: "light",
    pill: "bg-white/20 text-white",
    decor: "🏖️",
  },
];

const COUPONS = [
  { off: "DH50 OFF", cond: "orders DH300+", code: "SUMMER50" },
  { off: "DH120 OFF", cond: "orders DH600+", code: "SUMMER120" },
  { off: "DH250 OFF", cond: "orders DH1200+", code: "SUMMER250" },
];

const TILT = ["-6deg", "3deg", "8deg"];

function TiltCard({
  p,
  rotate,
  priority,
}: {
  p: HeroProduct;
  rotate: string;
  priority?: boolean;
}) {
  const onSale = p.compareAtCents != null && p.compareAtCents > p.priceCents;
  return (
    <Link
      href={`/products/${p.slug}`}
      className="w-32 flex-shrink-0 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 transition-transform duration-300 hover:!rotate-0 hover:scale-105 sm:w-40"
      style={{ transform: `rotate(${rotate})` }}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <Image
          src={p.image}
          alt={p.name}
          fill
          priority={priority}
          sizes="160px"
          className="object-cover"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 px-1 pb-1">
        <span className="text-sm font-bold text-neutral-900">
          {formatPrice(p.priceCents, p.currency)}
        </span>
        {onSale && (
          <span className="text-[11px] text-neutral-400 line-through">
            {formatPrice(p.compareAtCents!, p.currency)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function Hero({ cardsById }: { cardsById: Record<string, HeroProduct[]> }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const go = (dir: number) =>
    setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative h-[440px] w-full overflow-hidden sm:h-[460px]">
      {SLIDES.map((slide, i) => {
        const cards = cardsById[slide.id] ?? [];
        const dark = slide.text === "dark";
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${slide.bg} ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* faint oversized decoration */}
            <span className="pointer-events-none absolute right-6 top-4 select-none text-[120px] opacity-20">
              {slide.decor}
            </span>

            <div className="relative mx-auto flex h-full max-w-7xl items-center gap-6 px-6">
              {slide.variant === "cards" ? (
                <>
                  {/* Left copy */}
                  <div
                    className={`max-w-md flex-1 ${dark ? "text-neutral-900" : "text-white"}`}
                  >
                    {slide.eyebrow && (
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${slide.pill}`}
                      >
                        {slide.eyebrow}
                      </span>
                    )}
                    <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
                      {slide.title}
                    </h1>
                    {slide.subtitle && (
                      <p className="mt-3 max-w-sm text-sm opacity-80 sm:text-base">
                        {slide.subtitle}
                      </p>
                    )}
                    <Link
                      href={slide.href}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
                    >
                      {slide.cta} <ArrowRight size={16} />
                    </Link>
                  </div>

                  {/* Right tilted product cards */}
                  <div className="hidden flex-1 items-center justify-center gap-3 sm:flex">
                    {cards.slice(0, 3).map((p, ci) => (
                      <TiltCard
                        key={p.slug}
                        p={p}
                        rotate={TILT[ci] ?? "0deg"}
                        priority={i === 0}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Coupons variant */
                <div className="flex w-full flex-col gap-5 text-white">
                  <div>
                    <p className="text-sm font-medium opacity-90">
                      Sale ends soon · stack &amp; save
                    </p>
                    <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
                      <span className="font-serif italic text-amber-200">Summer</span>{" "}
                      Clearance
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {COUPONS.map((c) => (
                      <div
                        key={c.code}
                        className="rounded-xl bg-white/95 px-4 py-3 text-center text-blue-700 shadow-md"
                      >
                        <p className="text-lg font-extrabold leading-none">{c.off}</p>
                        <p className="mt-1 text-[11px] text-blue-500">{c.cond}</p>
                        <p className="mt-1 text-[11px] font-bold tracking-wide">
                          Code: {c.code}
                        </p>
                      </div>
                    ))}

                    {cards[0] && (
                      <Link
                        href={`/products/${cards[0].slug}`}
                        className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur transition hover:bg-white/25"
                      >
                        <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
                          <Image
                            src={cards[0].image}
                            alt={cards[0].name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                            Top deal
                          </p>
                          <p className="text-lg font-bold">
                            {formatPrice(cards[0].priceCents, cards[0].currency)}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>
                  <Link
                    href={slide.href}
                    className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    {slide.cta} <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Controls */}
      <button
        onClick={() => go(-1)}
        className="absolute left-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/10 p-2 text-neutral-800 backdrop-blur transition hover:bg-black/20 sm:flex"
        aria-label="Previous slide"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={() => go(1)}
        className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/10 p-2 text-neutral-800 backdrop-blur transition hover:bg-black/20 sm:flex"
        aria-label="Next slide"
      >
        <ChevronRight size={22} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full bg-neutral-800 transition-all ${
              i === index ? "w-6 opacity-90" : "w-2 opacity-40"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
