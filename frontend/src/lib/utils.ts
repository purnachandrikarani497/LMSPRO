import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY_SYMBOL = "₹";

/** Format a price with rupee symbol */
export function formatPrice(amount: number | undefined | null): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}
