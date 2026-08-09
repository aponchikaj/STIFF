export type Product = {
  slug: string;
  name: string;
  price: number;
  category: string;
  description: string;
  sizes: string[];
};

const APPAREL_SIZES = ["S", "M", "L", "XL"];
const ONE_SIZE = ["One size"];

export const products: Product[] = [
  {
    slug: "stiff-tee-01",
    name: "Stiff Tee 01",
    price: 120,
    category: "Tees",
    description:
      "Heavyweight 240gsm cotton tee. Boxy cut, dropped shoulder, asterisk mark printed at the chest.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "stiff-tee-02",
    name: "Stiff Tee 02",
    price: 120,
    category: "Tees",
    description:
      "Heavyweight 240gsm cotton tee. Full back print, tonal stitching, ribbed collar that keeps its shape.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "heavy-hoodie-01",
    name: "Heavy Hoodie 01",
    price: 260,
    category: "Hoodies",
    description:
      "480gsm brushed fleece hoodie. Double-layered hood, hidden pocket, embroidered asterisk at the cuff.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "heavy-hoodie-02",
    name: "Heavy Hoodie 02",
    price: 260,
    category: "Hoodies",
    description:
      "480gsm brushed fleece hoodie. Oversized fit, bonded seams, wordmark across the back in Archivo Black.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "wide-pants-01",
    name: "Wide Pants 01",
    price: 220,
    category: "Pants",
    description:
      "Wide-leg cotton twill pants. Deep pleats, adjustable hem, silent hardware.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "wide-pants-02",
    name: "Wide Pants 02",
    price: 220,
    category: "Pants",
    description:
      "Wide-leg cotton twill pants. Raw hem, tonal drawcord, asterisk rivet at the coin pocket.",
    sizes: APPAREL_SIZES,
  },
  {
    slug: "asterisk-cap",
    name: "Asterisk Cap",
    price: 90,
    category: "Accessories",
    description:
      "Six-panel unstructured cap. High-density asterisk embroidery, brass closure.",
    sizes: ONE_SIZE,
  },
  {
    slug: "asterisk-beanie",
    name: "Asterisk Beanie",
    price: 80,
    category: "Accessories",
    description:
      "Ribbed merino beanie. Fold-over cuff with woven asterisk label.",
    sizes: ONE_SIZE,
  },
];

export const featuredProducts = products.slice(0, 4);

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
