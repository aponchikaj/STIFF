import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Reveal } from "@/components/motion";
import { ProductControls } from "@/components/product-controls";
import { getProduct, products } from "@/lib/products";

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/clothing/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  return { title: product ? `${product.name} — STIFF` : "STIFF" };
}

export default async function ProductPage({
  params,
}: PageProps<"/clothing/[slug]">) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col gap-4">
        {/* Placeholder gallery blocks until product photography exists */}
        {[0, 1, 2].map((i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className="flex aspect-[3/4] items-center justify-center bg-surface">
              <AsteriskMark className="size-12 text-subtle" />
            </div>
          </Reveal>
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {product.category}
        </p>
        <h1 className="mt-2 text-4xl uppercase tracking-tight sm:text-5xl">
          {product.name}
        </h1>
        <p className="mt-3 text-lg text-muted">{product.price} ₾</p>
        <p className="mt-6 max-w-md text-sm leading-6 text-muted">
          {product.description}
        </p>
        <ProductControls sizes={product.sizes} />
      </div>
    </section>
  );
}
