// Mirrors of the backend response shapes. Keep in sync with backend/src.

export type Role = "user" | "admin";
export type TargetType = "product" | "gallery";
export type ReactionType = "like" | "dislike";
export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";
export type NotificationType =
  | "order_status"
  | "comment_reply"
  | "broadcast"
  | "system";
export type ContentKey = "about" | "contact-info" | "features";

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

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  images: string[];
  category: string | null;
  sizes: string[];
  stock: number;
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
  title: string;
  description: string | null;
  imageUrl: string;
  /** Intrinsic pixel size, so the layout can reserve the box before load. */
  width: number | null;
  height: number | null;
  sortOrder: number;
  isArchived: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
}

export type GalleryNeighbour = Pick<
  GalleryItem,
  "id" | "title" | "imageUrl" | "width" | "height"
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
  paymentIntentId: string | null;
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
  updatedAt: string;
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
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
}

export interface CreateGalleryItemInput {
  title: string;
  description?: string;
  imageUrl: string;
  width?: number;
  height?: number;
  sortOrder?: number;
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
