import { apiBlob, apiDownload, apiFetch } from "./client";
import type {
  AdminUser,
  AnalyticsOverview,
  BulkGalleryItemInput,
  CollabCodeAccess,
  CollabCodeRow,
  CollabCodeStatus,
  CollabOverview,
  CollabPlayback,
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
  ReorderEntry,
  Role,
  SafeUser,
  SiteContent,
  TimeseriesMetric,
  TimeseriesPoint,
  TopProduct,
  TrafficReport,
  UpdateGalleryItemInput,
  UpdateProductInput,
  UploadedImage,
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

/** Whole shoot in one request; untitled shots continue the archive numbering. */
export function createGalleryItems(
  items: BulkGalleryItemInput[],
): Promise<GalleryItem[]> {
  return apiFetch("/gallery/bulk", { method: "POST", body: { items } });
}

export function reorderGallery(
  items: ReorderEntry[],
): Promise<{ success: boolean; updated: number }> {
  return apiFetch("/gallery/reorder", { method: "PATCH", body: { items } });
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

export function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/uploads", { method: "POST", body: form });
}

// ---------- collab (STIFF × KEBURIA) ----------

const COLLAB_SLUG = "keburia";

/** Origin of the admin tab so printed QRs open this environment, not production. */
function collabSite(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

export function getCollab(): Promise<CollabOverview> {
  return apiFetch(`/collab/${COLLAB_SLUG}`, { query: { site: collabSite() } });
}

export function listCollabCodes(params?: {
  page?: number;
  pageSize?: number;
  status?: CollabCodeStatus;
}): Promise<Paginated<CollabCodeRow>> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes`, { query: { ...params } });
}

export function generateCollabCodes(
  count: number,
): Promise<{ created: number; total: number }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/generate`, {
    method: "POST",
    body: { count },
  });
}

export function updateCollab(data: {
  title?: string;
  maxCodes?: number;
  strictMode?: boolean;
}): Promise<CollabOverview> {
  return apiFetch(`/collab/${COLLAB_SLUG}`, {
    method: "PATCH",
    body: data,
  });
}

export function downloadCollabQrZip(): Promise<void> {
  return apiDownload(
    `/collab/${COLLAB_SLUG}/codes/qr.zip`,
    "stiff-keburia-qr.zip",
    { site: collabSite() },
  );
}

export function downloadCollabQr(id: string, serial: string): Promise<void> {
  return apiDownload(
    `/collab/${COLLAB_SLUG}/codes/${id}/qr`,
    `stiff-keburia-${serial}.png`,
    { site: collabSite() },
  );
}

export function fetchCollabQrBlob(id: string): Promise<Blob> {
  return apiBlob(`/collab/${COLLAB_SLUG}/codes/${id}/qr`, {
    site: collabSite(),
  });
}

export function getCollabCodeAccess(id: string): Promise<CollabCodeAccess> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}`);
}

export function updateCollabCode(
  id: string,
  data: { label?: string },
): Promise<CollabCodeRow> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function revokeCollabCode(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}/revoke`, {
    method: "POST",
  });
}

export function resetCollabCode(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}/reset`, {
    method: "POST",
  });
}

export function regenerateCollabCode(id: string): Promise<CollabCodeRow> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}/regenerate`, {
    method: "POST",
  });
}

export function deleteCollabCode(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/codes/${id}`, {
    method: "DELETE",
  });
}

export function uploadCollabVideo(file: File): Promise<{ success: boolean }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/collab/${COLLAB_SLUG}/video`, {
    method: "POST",
    body: form,
  });
}

export function deleteCollabVideo(): Promise<{ success: boolean }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/video`, { method: "DELETE" });
}

export function previewCollabVideo(): Promise<CollabPlayback> {
  return apiFetch(`/collab/${COLLAB_SLUG}/preview`);
}
