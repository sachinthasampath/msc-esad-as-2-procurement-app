export function formatMoney(value: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `Rs. ${formatted}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const TONES: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  APPROVED: "success",
  PAID: "success",
  FULLY_DELIVERED: "success",
  MATCH: "success",
  PENDING: "warning",
  ON_HOLD: "warning",
  HOLD: "warning",
  PARTIALLY_DELIVERED: "warning",
  PARTIAL: "warning",
  WAITING_APPROVAL: "warning",
  PARTIALLY_APPROVED: "warning",
  OVERDUE: "danger",
  DECLINED: "danger",
  REJECTED: "danger",
  MISMATCH: "danger",
  PLACED: "info",
  REFERRED: "info",
  RETURNED: "info",
  DRAFT: "neutral",
  CANCELLED: "neutral",
};

export function statusTone(status: string): string {
  return TONES[status] ?? "neutral";
}
