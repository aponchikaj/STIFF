"use client";

import Link from "next/link";
import { galleryApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ScaleIn } from "./motion";
import { ProductImage } from "./product-image";

/** Latest gallery shots for the home page; renders nothing while empty. */
export function GalleryPreview() {
  const { data } = useAsync(
    () => galleryApi.listGallery({ sort: "newest", pageSize: 4 }),
    [],
  );

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item, i) => (
        <li key={item.id}>
          <ScaleIn delay={i * 0.06}>
            <Link
              href={`/gallery/${item.id}`}
              className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              <ProductImage
                src={item.imageUrl}
                alt={item.title}
                aspect="aspect-square"
                className="transition-opacity group-hover:opacity-90"
              />
              <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                {item.title}
              </p>
            </Link>
          </ScaleIn>
        </li>
      ))}
    </ul>
  );
}
