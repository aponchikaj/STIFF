import { apiFetch } from "./client";
import type {
  AdminUser,
  AnalyticsOverview,
  Comment,
  ContactMessage,
  ContentKey,
  CreateGalleryItemInput,
  CreateProductInput,
  GalleryItem,
  Order,
  OrderStatus,
  Paginated,
  PaginationParams,
  Product,
  Role,
  SafeUser,
  SiteContent,
  TimeseriesMetric,
  TimeseriesPoint,
  TopProduct,
  TrafficReport,
  UpdateGalleryItemInput,
  UpdateProductInput,
  UserStats,
} from "./types";

// ---------- analytics ----------

export function getOverview(): Promise<AnalyticsOverview> {
  return apiFetch("/admin/analytics/overview");
}

export function getTimeseries(params: {
  from: string;
  to: string;
  metric: TimeseriesMetric;
}): Promise<{ points: TimeseriesPoint[] }> {
  return apiFetch("/admin/analytics/timeseries", { query: { ...params } });
}

export function getTopProducts(
  limit?: number,
): Promise<{ items: TopProduct[] }> {
  return apiFetch("/admin/analytics/top-products", { query: { limit } });
}

export function getTraffic(params: {
  from: string;
  to: string;
}): Promise<TrafficReport> {
  return apiFetch("/admin/analytics/traffic", { query: { ...params } });
}

// ---------- users ----------

export function listUsers(
  params?: PaginationParams & {
    search?: string;
    role?: Role;
    blocked?: boolean;
  },
): Promise<Paginated<AdminUser>> {
  return apiFetch("/users", { query: { ...params } });
}

export function getUser(
  id: string,
): Promise<SafeUser & { isBlocked: boolean; stats: UserStats }> {
  return apiFetch(`/users/${id}`);
}

export function blockUser(
  id: string,
  blocked: boolean,
): Promise<SafeUser & { isBlocked: boolean }> {
  return apiFetch(`/users/${id}/block`, {
    method: "PATCH",
    body: { blocked },
  });
}

export function changeRole(id: string, role: Role): Promise<SafeUser> {
  return apiFetch(`/users/${id}/role`, { method: "PATCH", body: { role } });
}

export function deleteUser(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/users/${id}`, { method: "DELETE" });
}

// ---------- products ----------

export function createProduct(data: CreateProductInput): Promise<Product> {
  return apiFetch("/products", { method: "POST", body: data });
}

export function updateProduct(
  id: string,
  data: UpdateProductInput,
): Promise<Product> {
  return apiFetch(`/products/${id}`, { method: "PUT", body: data });
}

export function deleteProduct(
  id: string,
): Promise<{ success: boolean; soft: boolean }> {
  return apiFetch(`/products/${id}`, { method: "DELETE" });
}

// ---------- gallery ----------

export function createGalleryItem(
  data: CreateGalleryItemInput,
): Promise<GalleryItem> {
  return apiFetch("/gallery", { method: "POST", body: data });
}

export function updateGalleryItem(
  id: string,
  data: UpdateGalleryItemInput,
): Promise<GalleryItem> {
  return apiFetch(`/gallery/${id}`, { method: "PUT", body: data });
}

export function deleteGalleryItem(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/gallery/${id}`, { method: "DELETE" });
}

// ---------- orders ----------

export function listOrders(
  params?: PaginationParams & {
    status?: OrderStatus;
    search?: string;
    from?: string;
    to?: string;
  },
): Promise<Paginated<Order>> {
  return apiFetch("/orders", { query: { ...params } });
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return apiFetch(`/orders/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function updateOrderDate(id: string, date: string): Promise<Order> {
  return apiFetch(`/orders/${id}/date`, { method: "PATCH", body: { date } });
}

export function deleteOrder(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/orders/${id}`, { method: "DELETE" });
}

// ---------- comments moderation ----------

export function listAllComments(
  params?: PaginationParams & { search?: string; userId?: string },
): Promise<Paginated<Comment>> {
  return apiFetch("/comments/all", { query: { ...params } });
}

// ---------- contact inbox ----------

export function listContacts(
  params?: PaginationParams & { handled?: boolean },
): Promise<Paginated<ContactMessage>> {
  return apiFetch("/contact", { query: { ...params } });
}

export function replyContact(
  id: string,
  message: string,
): Promise<ContactMessage> {
  return apiFetch(`/contact/${id}/reply`, {
    method: "POST",
    body: { message },
  });
}

export function setContactHandled(
  id: string,
  handled: boolean,
): Promise<ContactMessage> {
  return apiFetch(`/contact/${id}/handled`, {
    method: "PATCH",
    body: { handled },
  });
}

export function deleteContact(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/contact/${id}`, { method: "DELETE" });
}

// ---------- site content ----------

export function updateContent(
  key: ContentKey,
  value: Record<string, unknown>,
): Promise<SiteContent> {
  return apiFetch(`/content/${key}`, { method: "PUT", body: { value } });
}

// ---------- notifications ----------

export function broadcast(
  title: string,
  body: string,
): Promise<{ success: boolean; sent: number }> {
  return apiFetch("/notifications/broadcast", {
    method: "POST",
    body: { title, body },
  });
}

// ---------- uploads ----------

export function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/uploads", { method: "POST", body: form });
}
