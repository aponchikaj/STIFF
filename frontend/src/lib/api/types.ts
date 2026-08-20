// Mirrors of the backend response shapes. Keep in sync with backend/src.

export type Role = "user" | "admin";
export type TargetType = "product" | "gallery";
export type ReactionType = "like" | "dislike";
export type OrderStatus =
  | "pending"
  | "paid"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type NotificationType =
  | "order_status"
  | "comment_reply"
  | "broadcast"
  | "system";
/** Keys declared by the backend content registry (`content.registry.ts`). */
export type ContentKey =
  | "features"
  | "storefront"
  | "home-hero"
  | "home-values"
  | "home-join"
  | "about"
  | "contact-info"
  | "rules";

export interface SiteFeatures {
  shopEnabled: boolean;
}
export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular";
export type GallerySort = "newest" | "popular";
export type TimeseriesMetric = "revenue" | "orders" | "signups";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  isVerified: boolean;
  createdAt: string;
}

export interface AdminUser extends SafeUser {
  isBlocked: boolean;
  ordersCount: number;
}

export interface UserStats {
  totalSpentCents: number;
  ordersCount: number;
  commentsCount: number;
  likesGivenCount: number;
  memberSince: string;
}

export interface ProductVariant {
  id: string;
  size: string;
  /** Colourway label. Empty for a product sold in one colour. */
  color: string;
  /** Swatch fill `#rrggbb`, or null to show the label instead of a chip. */
  colorHex: string | null;
  /** Photographs of this colourway; empty falls back to the product's own. */
  images: string[];
  sku: string | null;
  stock: number;
  /** Added to the product price for this size. */
  priceDeltaCents: number;
  position: number;
  isActive: boolean;
  /** Units already promised against stock that does not exist yet. */
  preorderedCount?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  images: string[];
  /** Descriptions of `images`, aligned by index. May be shorter. */
  imageAlts: string[];
  category: string | null;
  /** Denormalised labels for browsing; `variants` is the source of truth. */
  sizes: string[];
  /** Sum of every variant's stock. */
  stock: number;
  variants: ProductVariant[];
  isActive: boolean;
  /** When the drop opens. Null means it is live now. */
  publishAt?: string | null;
  preorderEnabled?: boolean;
  preorderShipsAt?: string | null;
  preorderLimit?: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** -1 runs small, 0 true to size, 1 runs large. */
export type FitValue = -1 | 0 | 1;
export type FitVerdict = "runs_small" | "true_to_size" | "runs_large";

export interface FitReport {
  small: number;
  true: number;
  large: number;
  total: number;
  /** Null until enough buyers have answered to mean anything. */
  verdict: FitVerdict | null;
  /** How many of `total` chose the winning bucket. */
  agreeing: number | null;
  /** This viewer's own rating. */
  mine: FitValue | null;
  /** Whether this viewer bought the piece and may rate it. */
  canRate: boolean;
}

/** A shot from the archive that features this piece. */
export interface ArchiveShot {
  id: string;
  slug: string;
  title: string;
  altText: string | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
  rotation: number;
}

export interface ProductDetail extends Product {
  myReaction: ReactionType | null;
  fit: FitReport;
  archiveShots: ArchiveShot[];
}

/** The jobs a shoot is credited in. Mirrors CREDIT_ROLES on the backend. */
export type CreditRole =
  | "photographer"
  | "model"
  | "stylist"
  | "makeup"
  | "hair"
  | "art_direction"
  | "set_design"
  | "retouch"
  | "assistant"
  | "location";

export interface GalleryCredit {
  id: string;
  role: CreditRole;
  name: string;
  /** Stored without the leading @; the display and the URL both derive from it. */
  instagram: string | null;
  url: string | null;
  sortOrder: number;
}

export type TagKind = "season" | "location" | "theme";

export interface GalleryTag {
  id: string;
  slug: string;
  label: string;
  kind: TagKind;
  sortOrder: number;
}

/** A tag with how many live shots carry it. */
export interface GalleryTagWithCount extends GalleryTag {
  count: number;
}

export interface GalleryShoot {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  /** A calendar day, `YYYY-MM-DD` — a shoot has no meaningful hour. */
  shotOn: string | null;
  coverItemId: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
}

export interface ShootSummary extends GalleryShoot {
  cover: GalleryItem | null;
  shotCount: number;
}

export interface ShootDetail extends ShootSummary {
  items: GalleryItem[];
  credits: GalleryCredit[];
}

export interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  /** Written description of the photograph; falls back to the title. */
  altText: string | null;
  imageUrl: string;
  /** Intrinsic pixel size, so the layout can reserve the box before load. */
  width: number | null;
  height: number | null;
  /** Clockwise degrees applied at delivery. 0 / omitted means the file is already upright. */
  rotation?: number;
  /**
   * Inline base64 stand-in shown while the photograph decodes. Null until the
   * shot has been processed; the surface color holds the box either way.
   */
  blurDataUrl?: string | null;
  shootId?: string | null;
  tags?: GalleryTag[];
  sortOrder: number;
  isArchived: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
}

/** A piece worn in a shot, and where on the frame it is worn. */
export interface ProductInShot extends Product {
  /** Percentages of the displayed frame, after rotation. Null means unpinned. */
  hotspotX: number | null;
  hotspotY: number | null;
}

export type GalleryNeighbour = Pick<
  GalleryItem,
  | "id"
  | "slug"
  | "title"
  | "altText"
  | "imageUrl"
  | "width"
  | "height"
  | "rotation"
>;

export interface GalleryItemDetail extends GalleryItem {
  myReaction: ReactionType | null;
  /** The pieces worn in this shot, with their pins — "shop the look". */
  products: ProductInShot[];
  tags: GalleryTag[];
  /** This frame's credits, falling back to its shoot's. */
  credits: GalleryCredit[];
  shoot: GalleryShoot | null;
  /** 1-based position in the archive, for the "042 / 057" counter. */
  position: number;
  total: number;
  prev: GalleryNeighbour | null;
  next: GalleryNeighbour | null;
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  /** The exact row this line buys — colour and size together. */
  variantId: string | null;
  variant?: ProductVariant | null;
  quantity: number;
  size: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartView {
  items: CartItem[];
  subtotalCents: number;
}

export interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  /** One of the eleven Georgian regions. */
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  productImage: string | null;
  unitPriceCents: number;
  quantity: number;
  size: string;
  /** Snapshot of the colourway, empty for a one-colour product. */
  color?: string;
}

export interface Order {
  id: string;
  userId: string | null;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  paymentMethod?: PaymentMethodKey;
  guestEmail?: string | null;
  subtotalCents?: number;
  discountCode?: string | null;
  discountCents?: number;
  giftCardCode?: string | null;
  giftCardCents?: number;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: "customer" | "admin" | null;
  paymentIntentId: string | null;
  shippingMethod?: "pickup" | "tbilisi" | "regions";
  shippingCents?: number;
  shippingAddress: ShippingAddress | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  user?: Pick<SafeUser, "id" | "username" | "email">;
}

export interface Comment {
  id: string;
  targetType: TargetType;
  targetId: string;
  body: string;
  parentId: string | null;
  user: { id: string; username: string };
  /** Owns a paid order containing this product. Absent on gallery comments. */
  verifiedBuyer?: boolean;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface ReactionResult {
  myReaction: ReactionType | null;
  likeCount: number;
  dislikeCount: number;
}

export interface MyReaction {
  id: string;
  userId: string;
  targetType: TargetType;
  targetId: string;
  type: ReactionType;
  createdAt: string;
}

export interface NotificationMeta {
  orderId?: string;
  commentId?: string;
  targetType?: string;
  targetId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  meta: NotificationMeta | null;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  isHandled: boolean;
  createdAt: string;
}

export interface SiteContent {
  key: string;
  value: Record<string, unknown>;
  /** Null when the block has never been saved and is showing shipped copy. */
  updatedAt: string | null;
}

export interface ContentListItem {
  title: string;
  body: string;
}

export type ContentFieldType = "text" | "textarea" | "boolean" | "list";

export interface ContentField {
  key: string;
  label: string;
  type: ContentFieldType;
  default: string | boolean | ContentListItem[];
  hint?: string;
  maxLength?: number;
}

export interface ContentBlock {
  key: ContentKey;
  label: string;
  group: string;
  description?: string;
  fields: ContentField[];
}

export interface AnalyticsOverview {
  totalRevenueCents: number;
  totalOrders: number;
  totalUsers: number;
  totalProducts: number;
  pendingContacts: number;
  revenueThisMonthCents: number;
  signupsThisMonth: number;
}

export interface TimeseriesPoint {
  date: string;
  value: number;
}

export interface TrafficDay {
  date: string;
  views: number;
  visitors: number;
}

export interface TrafficPage {
  path: string;
  views: number;
  visitors: number;
}

export interface TrafficReport {
  summary: {
    todayViews: number;
    todayVisitors: number;
    rangeViews: number;
    rangeVisitors: number;
  };
  days: TrafficDay[];
  topPages: TrafficPage[];
  topProducts: TrafficPage[];
}

export interface TopProduct {
  productId: string | null;
  name: string;
  unitsSold: number;
  revenueCents: number;
}

export interface UserSettings {
  theme: "light" | "dark";
  emailNotifications: boolean;
  [key: string]: unknown;
}

export interface SearchResults {
  query: string;
  products: Product[];
  gallery: GalleryItem[];
}

export type CollabCodeStatus = "unused" | "claimed" | "revoked";

export interface CollabOverview {
  slug: string;
  title: string;
  maxCodes: number;
  strictMode: boolean;
  unused: number;
  claimed: number;
  revoked: number;
  total: number;
  hasVideo: boolean;
  videoUploadedAt: string | null;
  qrBaseUrl: string;
}

export interface CollabCodeRow {
  id: string;
  serial: string;
  status: CollabCodeStatus;
  label: string | null;
  claimedAt: string | null;
  createdAt: string;
}

export interface CollabCodeAccess {
  serial: string;
  token: string;
  path: string;
}

export interface CollabSessionView {
  serial: string;
  title: string;
  hasVideo: boolean;
  strictMode: boolean;
}

export interface CollabPlayback {
  url: string;
  expiresAt: string | null;
  serial: string;
  title: string;
  mode: "signed" | "proxy";
  strictMode: boolean;
}

export interface CollabPublicConfig {
  title: string;
  strictMode: boolean;
  hasVideo: boolean;
}

// ---------- request param types ----------

export interface ProductListParams extends PaginationParams {
  /** Fetch an explicit set — what "recently viewed" reads from localStorage. */
  ids?: string[];
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export interface GalleryListParams extends PaginationParams {
  sort?: GallerySort;
  includeArchived?: boolean;
  /** Tag slugs. Several narrow rather than widen: season *and* place. */
  tag?: string[];
  shoot?: string;
  /**
   * Keyset position from a previous page's `nextCursor`. Supersedes `page`,
   * and is how the grid pages: offset paging drifts when the archive moves
   * under a scroll.
   */
  cursor?: string;
}

/** A page of the archive. `nextCursor` is null on the last one. */
export interface PaginatedShots extends Paginated<GalleryItem> {
  nextCursor: string | null;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface VariantInput {
  id?: string;
  size: string;
  color?: string;
  colorHex?: string | null;
  images?: string[];
  sku?: string;
  stock: number;
  priceDeltaCents?: number;
  isActive?: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  priceCents: number;
  images?: string[];
  imageAlts?: string[];
  category?: string;
  /** The full set of buyable sizes. Replaces the old sizes + stock pair. */
  variants?: VariantInput[];
  /** Legacy shape, still accepted so an older admin build keeps working. */
  sizes?: string[];
  stock?: number;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
  /** When the drop opens. Null publishes as soon as it is active. */
  publishAt?: string | null;
  preorderEnabled?: boolean;
  preorderShipsAt?: string;
  preorderLimit?: number;
}

/** A piece worn in a shot, with its pin if one was placed. */
export interface ProductTagInput {
  productId: string;
  hotspotX?: number;
  hotspotY?: number;
}

export interface CreditInput {
  role: CreditRole;
  name: string;
  instagram?: string;
  url?: string;
  sortOrder?: number;
}

export interface ShootInput {
  title?: string;
  slug?: string;
  description?: string;
  location?: string;
  shotOn?: string;
  coverItemId?: string;
  sortOrder?: number;
  isPublished?: boolean;
  /** The whole roll, in order. Replaces whatever the shoot held before. */
  itemIds?: string[];
  credits?: CreditInput[];
}

export interface TagInput {
  label?: string;
  slug?: string;
  kind?: TagKind;
  sortOrder?: number;
}

export interface CreateGalleryItemInput {
  title: string;
  /** The pieces worn in this shot. Omit to leave existing links alone. */
  productIds?: string[];
  /** The same, with pins. Supersedes `productIds` when both are sent. */
  productTags?: ProductTagInput[];
  shootId?: string | null;
  tagIds?: string[];
  /** Credits specific to this frame, on top of the shoot's. */
  credits?: CreditInput[];
  slug?: string;
  description?: string;
  altText?: string;
  imageUrl: string;
  width?: number;
  height?: number;
  rotation?: number;
  sortOrder?: number;
}

/** A shot in a bulk upload — the archive numbers it when no title is given. */
export type BulkGalleryItemInput = Omit<CreateGalleryItemInput, "title"> & {
  title?: string;
};

export interface ReorderEntry {
  id: string;
  sortOrder: number;
}

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
  /**
   * Clockwise degrees the file's own EXIF orientation asks for, so the
   * uploader can pre-fill it. A suggestion, not a decision — the preview shows
   * the turned result and it can be overridden before publishing.
   */
  rotation?: number;
}

export type UpdateGalleryItemInput = Partial<CreateGalleryItemInput> & {
  isArchived?: boolean;
};

export interface ContactInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

// ---------- payments ----------

export type PaymentMethodKey =
  | "cod"
  | "bank_transfer"
  | "card_tbc"
  | "card_bog";

export interface PaymentAvailability {
  method: PaymentMethodKey;
  label: string;
  note: string;
  /** False renders the option disabled rather than hiding it. */
  available: boolean;
  /** True when choosing this will not really move money. */
  testMode: boolean;
}

/** What the buyer has to do next, returned alongside a placed order. */
export type PaymentStart =
  | { kind: "on_delivery" }
  | { kind: "instructions"; heading: string; lines: string[] }
  | { kind: "redirect"; url: string; reference: string }
  | { kind: "simulated"; reference: string };

export interface PlacedOrder {
  order: Order;
  payment: PaymentStart;
}

// ---------- returns ----------

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded";

export interface ReturnRequestItem {
  id: string;
  orderItemId: string;
  quantity: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  status: ReturnStatus;
  reason: string;
  resolutionNote: string;
  refundCents: number;
  resolvedAt: string | null;
  items: ReturnRequestItem[];
  order?: Order;
  createdAt: string;
  updatedAt: string;
}

/** Whether the receipt page should offer the return button, and why not. */
export interface ReturnEligibility {
  allowed: boolean;
  reason?: string;
  closesAt?: string;
  openRequestId?: string;
}

// ---------- promotions ----------

export type DiscountKind = "percent" | "fixed" | "free_shipping";

/** What an order costs, from the one engine that decides it. */
export interface PriceBreakdown {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  giftCardCents: number;
  totalCents: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number;
  minSubtotalCents: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  note: string;
  createdAt: string;
}

export interface GiftCard {
  id: string;
  code: string;
  initialCents: number;
  remainingCents: number;
  isActive: boolean;
  expiresAt: string | null;
  note: string;
  createdAt: string;
}

// ---------- customer conveniences ----------

export interface UserAddress {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  /** Normalised to +995XXXXXXXXX. */
  phone: string;
  isDefault: boolean;
  createdAt: string;
}
