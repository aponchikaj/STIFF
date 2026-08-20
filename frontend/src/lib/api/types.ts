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
  sku: string | null;
  stock: number;
  /** Added to the product price for this size. */
  priceDeltaCents: number;
  position: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  images: string[];
  category: string | null;
  /** Denormalised labels for browsing; `variants` is the source of truth. */
  sizes: string[];
  /** Sum of every variant's stock. */
  stock: number;
  variants: ProductVariant[];
  isActive: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  myReaction: ReactionType | null;
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
  sortOrder: number;
  isArchived: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
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
}

export interface Order {
  id: string;
  userId: string | null;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  paymentMethod?: PaymentMethodKey;
  guestEmail?: string | null;
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
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export interface GalleryListParams extends PaginationParams {
  sort?: GallerySort;
  includeArchived?: boolean;
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

export interface CreateProductInput {
  name: string;
  description?: string;
  priceCents: number;
  images?: string[];
  category?: string;
  sizes?: string[];
  stock?: number;
  stockBySize?: Record<string, number>;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
}

export interface CreateGalleryItemInput {
  title: string;
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
