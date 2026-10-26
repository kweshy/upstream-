import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export interface CatalogProduct {
  id: string;
  name: string;
  size_label: string;
  description: string;
  price_kes: number;
  deposit_kes: number;
  category: string;
}

export interface CatalogSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  cutoff_minutes: number;
}

async function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await publicClient();
  const [products, slots] = await Promise.all([
    supabase.from("products").select("id, name, size_label, description, price_kes, deposit_kes, category").eq("is_active", true).order("sort_order"),
    supabase.from("delivery_slots").select("id, label, start_time, end_time, cutoff_minutes").eq("is_active", true).order("sort_order"),
  ]);
  return {
    products: (products.data ?? []) as CatalogProduct[],
    slots: (slots.data ?? []) as CatalogSlot[],
  };
});
