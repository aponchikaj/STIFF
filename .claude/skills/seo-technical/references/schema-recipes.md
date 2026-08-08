# JSON-LD Schema Recipes

Copy-paste structured data recipes. Every recipe goes in a `<script type="application/ld+json">` tag in the `<head>` or `<body>`. Replace placeholder values, delete optional fields you can't fill honestly, and validate with the Rich Results Test (https://search.google.com/test/rich-results) before shipping.

## Table of Contents

1. [Global rules](#global-rules)
2. [Organization](#organization)
3. [Product](#product)
4. [Article](#article)
5. [FAQPage](#faqpage)
6. [BreadcrumbList](#breadcrumblist)
7. [LocalBusiness](#localbusiness)
8. [HowTo](#howto)
9. [Combining multiple types on one page](#combining-multiple-types-on-one-page)

## Global rules

- Markup must describe content visible on the page. Marking up content the user can't see risks a structured-data manual action.
- One JSON-LD block can hold multiple types via `@graph` (see last section), or use separate script tags — both work.
- Use absolute URLs everywhere (`url`, `image`, `logo`, `item`).
- `@id` values are stable identifiers, not links — use them to cross-reference entities (e.g., Article `publisher` pointing at the site's Organization). Convention: `https://example.com/#organization`.
- Dates use ISO 8601 with timezone: `2026-08-08T09:00:00+00:00`.
- Rich-result eligibility is per type and never guaranteed; valid markup makes a page eligible, not entitled.

## Organization

Where: homepage (once, site-wide identity). Feeds the knowledge panel and brand logo in results.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://example.com/#organization",
  "name": "Example Inc.",
  "url": "https://example.com/",
  "logo": {
    "@type": "ImageObject",
    "url": "https://example.com/assets/logo-600x600.png",
    "width": 600,
    "height": 600
  },
  "description": "One-sentence description of what the company does.",
  "sameAs": [
    "https://twitter.com/example",
    "https://www.linkedin.com/company/example",
    "https://github.com/example"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@example.com",
    "availableLanguage": ["English"]
  }
}
</script>
```

Notes:
- `logo` should be at least 112x112px, on a URL Googlebot can fetch (not robots.txt-blocked).
- `sameAs` links official profiles only — it disambiguates the brand entity.
- Required: `name`, `url`. Everything else recommended.

## Product

Where: product detail pages. Eligible for price, availability, and review stars in results. Google increasingly expects `Offer` details for merchant experiences.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Acme Anvil 3000",
  "image": [
    "https://example.com/photos/anvil-1x1.jpg",
    "https://example.com/photos/anvil-4x3.jpg",
    "https://example.com/photos/anvil-16x9.jpg"
  ],
  "description": "Drop-forged 45kg anvil with hardened steel face.",
  "sku": "ANV-3000",
  "brand": {
    "@type": "Brand",
    "name": "Acme"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/products/anvil-3000",
    "priceCurrency": "USD",
    "price": 249.00,
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": 0,
        "currency": "USD"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "US"
      }
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.6,
    "reviewCount": 128
  },
  "review": {
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": 5
    },
    "author": {
      "@type": "Person",
      "name": "Jane Coyote"
    },
    "reviewBody": "Stopped every roadrunner-related mishap. Solid."
  }
}
</script>
```

Notes:
- Required for rich results: `name` plus at least one of `review`, `aggregateRating`, or `offers`.
- `availability` values: `InStock`, `OutOfStock`, `PreOrder`, `BackOrder`, `Discontinued` (full schema.org URLs as above).
- Only include `aggregateRating`/`review` if real reviews are visible on the page — fabricated ratings are the most common structured-data manual action.
- Provide images in 1:1, 4:3, and 16:9 where possible; minimum 50k pixels total.
- For SaaS, price is usually per-plan: use one `Offer` per tier inside an `offers` array, or `AggregateOffer` with `lowPrice`/`highPrice`.

## Article

Where: blog posts, news, editorial content. Covers `Article`, `BlogPosting` (swap `@type`), and `NewsArticle`.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How We Cut LCP From 4.1s to 1.8s",
  "description": "A case study in image preloading and server-side rendering.",
  "image": [
    "https://example.com/posts/lcp-case-study/cover-16x9.jpg",
    "https://example.com/posts/lcp-case-study/cover-4x3.jpg",
    "https://example.com/posts/lcp-case-study/cover-1x1.jpg"
  ],
  "datePublished": "2026-08-01T09:00:00+00:00",
  "dateModified": "2026-08-08T14:30:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Jane Doe",
    "url": "https://example.com/authors/jane-doe"
  },
  "publisher": {
    "@id": "https://example.com/#organization"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/posts/lcp-case-study"
  }
}
</script>
```

Notes:
- `headline` max 110 characters; should match the visible H1 closely.
- `dateModified` follows the same honesty rule as sitemap lastmod — only bump it for real content changes.
- `author.url` pointing at an author page strengthens E-E-A-T entity signals; use `Organization` as author type for unbylined posts.
- `publisher` references the Organization `@id` from the homepage recipe — keeps one canonical definition.

## FAQPage

Where: pages with a visible list of questions and answers. Note: since 2023 Google shows FAQ rich results mainly for well-known, authoritative government and health sites — mark up anyway for entity understanding and other engines, but don't promise the dropdown appearance.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you offer a free trial?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes — every plan includes a 14-day free trial. No credit card required."
      }
    },
    {
      "@type": "Question",
      "name": "Can I cancel anytime?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Cancel from the billing page and you keep access until the end of the paid period."
      }
    },
    {
      "@type": "Question",
      "name": "Do you support SSO?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SAML and OIDC single sign-on are included on the Business plan and above."
      }
    }
  ]
}
</script>
```

Notes:
- Every Q&A pair must be visible on the page (accordions that expand count as visible).
- One `FAQPage` per page maximum; don't mark up a single question this way (that's `QAPage`, for forum-style content where users submit answers).
- Answers can contain limited HTML (`<a>`, `<b>`, `<ol>`, `<ul>`, `<p>`, `<br>`) escaped inside the `text` string.

## BreadcrumbList

Where: every page below the homepage. Replaces the raw URL with a readable trail in search results.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://example.com/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "How We Cut LCP From 4.1s to 1.8s"
    }
  ]
}
</script>
```

Notes:
- The final item (current page) may omit `item` — its URL is the page itself.
- `position` starts at 1 and must be sequential.
- The trail should mirror visible breadcrumb navigation; site hierarchy, not the click path the user took.
- Multiple trails to one page? Emit multiple `BreadcrumbList` objects.

## LocalBusiness

Where: the location page (or homepage for single-location businesses). Use the most specific subtype that fits: `Restaurant`, `Dentist`, `Plumber`, `Store`, `LegalService`, etc. — specificity improves matching.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": "https://example.com/#localbusiness",
  "name": "Example Bistro",
  "image": "https://example.com/photos/storefront.jpg",
  "url": "https://example.com/",
  "telephone": "+14155551234",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "San Francisco",
    "addressRegion": "CA",
    "postalCode": "94105",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 37.7936,
    "longitude": -122.3965
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "11:00",
      "closes": "22:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "10:00",
      "closes": "23:00"
    }
  ],
  "servesCuisine": "French",
  "menu": "https://example.com/menu",
  "sameAs": [
    "https://www.instagram.com/examplebistro",
    "https://maps.google.com/?cid=1234567890"
  ]
}
</script>
```

Notes:
- Required: `name`, `address`. Strongly recommended: `telephone`, `openingHoursSpecification`, `geo`, `url`, `image`.
- Name, address, and phone (NAP) must exactly match the Google Business Profile listing — inconsistency dilutes local ranking signals.
- Closed on a day? Simply omit it from `openingHoursSpecification`. 24/7: `opens: "00:00"`, `closes: "23:59"`.
- Multi-location businesses: one LocalBusiness block per location page, each with a unique `@id`.
- `servesCuisine` and `menu` are Restaurant-specific — drop them for other subtypes.

## HowTo

Where: step-by-step instructional pages. Note: Google deprecated HowTo rich results on mobile in 2023 and desktop shortly after — the visual treatment is gone, but the markup still aids machine understanding and other consumers. Don't invest heavily here; include it only when the page is genuinely instructional.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Set Up SPF for Your Domain",
  "description": "Add an SPF record so receiving mail servers can verify your sending IPs.",
  "totalTime": "PT15M",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": 0
  },
  "tool": [
    {
      "@type": "HowToTool",
      "name": "Access to your DNS provider's dashboard"
    }
  ],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "List your sending services",
      "text": "Write down every service that sends email for your domain: your mail host, marketing platform, and transactional provider.",
      "url": "https://example.com/guides/spf#step-1"
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Build the SPF record",
      "text": "Combine the include mechanisms into one TXT record, e.g. v=spf1 include:_spf.google.com include:sendgrid.net ~all.",
      "url": "https://example.com/guides/spf#step-2"
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Publish and verify",
      "text": "Add the TXT record at your domain root, wait for DNS propagation, then verify with a lookup tool. Keep it to a single SPF record with at most 10 DNS lookups.",
      "url": "https://example.com/guides/spf#step-3",
      "image": "https://example.com/guides/spf/verify-screenshot.png"
    }
  ]
}
</script>
```

Notes:
- `totalTime` uses ISO 8601 duration (`PT15M` = 15 minutes, `PT1H30M` = 1.5 hours).
- Each step's `url` should anchor-link to the visible step on the page.
- Don't use HowTo for recipes (`Recipe` type) or product FAQs — Google flags mismatched types as spammy markup.

## Combining multiple types on one page

Use `@graph` to emit several entities in one block and cross-reference them by `@id`. Typical article page: Organization + BreadcrumbList + BlogPosting.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example Inc.",
      "url": "https://example.com/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/assets/logo-600x600.png"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://example.com/posts/lcp-case-study#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://example.com/blog" },
        { "@type": "ListItem", "position": 3, "name": "How We Cut LCP From 4.1s to 1.8s" }
      ]
    },
    {
      "@type": "BlogPosting",
      "headline": "How We Cut LCP From 4.1s to 1.8s",
      "datePublished": "2026-08-01T09:00:00+00:00",
      "author": { "@type": "Person", "name": "Jane Doe" },
      "publisher": { "@id": "https://example.com/#organization" },
      "mainEntityOfPage": { "@id": "https://example.com/posts/lcp-case-study" }
    }
  ]
}
</script>
```

Validation checklist before every deploy:

1. Rich Results Test passes with zero errors (warnings are optional-field suggestions — fix when the data exists).
2. Schema.org validator (https://validator.schema.org/) for types the Rich Results Test doesn't cover.
3. The rendered page HTML actually contains the script tag — if JSON-LD is injected client-side, confirm it appears in URL Inspection's rendered HTML.
4. Search Console → Enhancements reports show the pages as valid within a few weeks of deploy; investigate any "Invalid items" trend after template changes.
