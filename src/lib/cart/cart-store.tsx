"use client";

// Multi-listing cart for group bookings. Phase 1: client-side state only,
// persisted to localStorage. Phase 3 will add Supabase persistence + cross-
// device sync. Phase 2 owns the actual checkout (single Stripe payment intent
// + sequential reservations + atomic rollback on partial failure).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { FloatingCartPill } from "@/components/cart/floating-cart-pill";

const STORAGE_KEY = "traverse:cart:v1";

/** Hard cap on cart size — backend enforces the same limit, but the UI
 * surfaces it before users try to check out. Sequential reservation
 * processing budget at 5 lines is ~55s, just under Vercel's 60s function
 * timeout. */
export const CART_MAX_ITEMS = 5;

export interface CartItem {
  /** Stable per-cart-line id so React keys + remove operations work. */
  lineId: string;
  /** Guesty BEAPI listing _id. */
  listingId: string;
  /** Display snapshot — captured at add-to-cart time so the cart can render
   * even if the property page hasn't been mounted in this session. */
  listingTitle: string;
  listingNickname: string | null;
  listingPicture: string | null;
  bedrooms: number | null;
  accommodates: number | null;
  city: string | null;
  /** Stay window — ISO YYYY-MM-DD. */
  checkIn: string;
  checkOut: string;
  /** Total guests (adults + children). */
  guests: number;
  /** Pet count — informational at this layer; real pet fees applied at
   * checkout via the existing per-listing quote logic. */
  pets: number;
  /** Snapshot price-per-night displayed at the property page. The real
   * total comes from the live batch quote at /cart and at checkout. */
  nightlyPriceSnapshot: number | null;
  /** ISO timestamp for cart-age sorting + abandoned-cart triggers later. */
  addedAt: string;
}

interface CartState {
  items: CartItem[];
  /** Hydrated from localStorage. Until this flips true, callers should
   * render a skeleton — otherwise cart count flickers from 0 → real on
   * client hydration. */
  hydrated: boolean;
}

interface CartContextValue extends CartState {
  /**
   * Add a listing to the cart. If the same (listingId, checkIn, checkOut,
   * guests) tuple is already in the cart, returns the existing line — does
   * not duplicate. Returns null if the cart is full (CART_MAX_ITEMS reached);
   * callers should surface a friendly message in that case.
   */
  addItem: (item: Omit<CartItem, "lineId" | "addedAt">) => CartItem | null;
  /** Remove a single line by its lineId. */
  removeItem: (lineId: string) => void;
  /** Update an existing line (e.g., change dates or guests). */
  updateItem: (lineId: string, patch: Partial<Omit<CartItem, "lineId">>) => void;
  /** Clear everything — typically called after successful checkout. */
  clearCart: () => void;
  /**
   * Returns the cart line that matches the given listing+dates+guests, if
   * any. Used by AddToCartButton to show "In cart ✓" instead of "Add to cart".
   */
  findMatch: (
    listingId: string,
    checkIn: string,
    checkOut: string,
    guests: number
  ) => CartItem | null;
  /** Drawer open state — exposed globally so AddToCartButton can open the
   * drawer immediately on add (instant visual confirmation + a one-click
   * path to /cart without scrolling back to the header). */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function generateLineId(): string {
  // Crypto.randomUUID is widely available; fall back for older environments.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Defensive: drop anything that doesn't have the required fields. This
    // protects against schema drift between deploys without crashing.
    return parsed.filter(
      (x): x is CartItem =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as CartItem).lineId === "string" &&
        typeof (x as CartItem).listingId === "string" &&
        typeof (x as CartItem).checkIn === "string" &&
        typeof (x as CartItem).checkOut === "string" &&
        typeof (x as CartItem).guests === "number"
    );
  } catch {
    return [];
  }
}

function writeToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage quota or private browsing — silently ignore */
  }
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error(
      "useCart must be used inside <CartProvider>. Mount it in app/layout.tsx."
    );
  }
  return ctx;
}

interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate after mount — never read localStorage during SSR. The empty
  // initial state means cart-count badges render "0" on first paint, then
  // update to the real count on hydration. Acceptable trade since cart
  // hydration latency is <16ms typical.
  useEffect(() => {
    setItems(readFromStorage());
    setHydrated(true);
  }, []);

  // Persist on every change after hydration. Skipping the pre-hydration
  // write avoids clobbering the stored cart with the empty initial state.
  useEffect(() => {
    if (!hydrated) return;
    writeToStorage(items);
  }, [items, hydrated]);

  // Cross-tab sync — if the user has the site open in two tabs and adds
  // something in one, the other reflects the change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setItems(readFromStorage());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, "lineId" | "addedAt">): CartItem | null => {
      let added: CartItem | null = null;
      let rejected = false;
      setItems((prev) => {
        // Deduplicate on (listingId, dates, guests)
        const existing = prev.find(
          (l) =>
            l.listingId === item.listingId &&
            l.checkIn === item.checkIn &&
            l.checkOut === item.checkOut &&
            l.guests === item.guests
        );
        if (existing) {
          added = existing;
          return prev;
        }
        // Hard cap on cart size. Already-deduped existing item bypasses
        // the cap (no-op return above); only NEW items count toward the limit.
        if (prev.length >= CART_MAX_ITEMS) {
          rejected = true;
          return prev;
        }
        const next: CartItem = {
          ...item,
          lineId: generateLineId(),
          addedAt: new Date().toISOString(),
        };
        added = next;
        return [...prev, next];
      });
      if (rejected) return null;
      return added!;
    },
    []
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const updateItem = useCallback(
    (lineId: string, patch: Partial<Omit<CartItem, "lineId">>) => {
      setItems((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l))
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const findMatch = useCallback(
    (
      listingId: string,
      checkIn: string,
      checkOut: string,
      guests: number
    ): CartItem | null => {
      return (
        items.find(
          (l) =>
            l.listingId === listingId &&
            l.checkIn === checkIn &&
            l.checkOut === checkOut &&
            l.guests === guests
        ) ?? null
      );
    },
    [items]
  );

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      addItem,
      removeItem,
      updateItem,
      clearCart,
      findMatch,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [
      items,
      hydrated,
      addItem,
      removeItem,
      updateItem,
      clearCart,
      findMatch,
      drawerOpen,
      openDrawer,
      closeDrawer,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Drawer mounted here so it's available on every page — including
          immediately after AddToCartButton calls openDrawer() — without
          depending on whether the header is currently rendered. */}
      <CartDrawer />
      {/* Floating cart pill — bottom-right, always visible when cart has
          items and the drawer is closed. Gives a one-tap path back to the
          cart from anywhere, no matter how far the user has scrolled. */}
      <FloatingCartPill />
    </CartContext.Provider>
  );
}
