import { apiFetch } from "./client";
import type { UserAddress } from "./types";

// ---------- saved addresses ----------

export function listAddresses(): Promise<UserAddress[]> {
  return apiFetch("/addresses");
}

export interface AddressInput {
  label?: string;
  firstName: string;
  lastName: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone: string;
  isDefault?: boolean;
}

export function createAddress(data: AddressInput): Promise<UserAddress> {
  return apiFetch("/addresses", { method: "POST", body: data });
}

export function updateAddress(
  id: string,
  data: AddressInput,
): Promise<UserAddress> {
  return apiFetch(`/addresses/${id}`, { method: "PATCH", body: data });
}

export function deleteAddress(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/addresses/${id}`, { method: "DELETE" });
}

/** The regions the checkout dropdown offers. */
export function getRegions(): Promise<{ regions: string[] }> {
  return apiFetch("/addresses/regions");
}
