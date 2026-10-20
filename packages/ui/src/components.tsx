import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { formatMoney, statusLabel, statusTone } from "./format";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-[var(--px-navy)] text-white hover:bg-slate-800",
    secondary: "border border-[var(--px-line)] bg-white text-[var(--px-navy)] hover:bg-slate-50",
    danger: "bg-[var(--px-danger-bg)] text-[var(--px-danger)] hover:bg-red-100",
    ghost: "text-[var(--px-muted)] hover:bg-slate-100",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-[10px] border border-[var(--px-line)] bg-white px-3 py-2 outline-none ring-[var(--px-blue)] focus:ring-2"
        {...props}
      />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-[10px] border border-[var(--px-line)] bg-white px-3 py-2 outline-none ring-[var(--px-blue)] focus:ring-2"
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-[10px] border border-[var(--px-line)] bg-white px-3 py-2 outline-none ring-[var(--px-blue)] focus:ring-2"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="search"
      className="w-full rounded-[10px] border border-[var(--px-line)] bg-white px-3 py-2 text-sm outline-none ring-[var(--px-blue)] focus:ring-2"
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const colors: Record<string, string> = {
    success: "bg-[var(--px-success-bg)] text-[var(--px-success)]",
    warning: "bg-[var(--px-warning-bg)] text-[var(--px-warning)]",
    danger: "bg-[var(--px-danger-bg)] text-[var(--px-danger)]",
    info: "bg-[var(--px-info-bg)] text-[var(--px-info)]",
    neutral: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex shrink-0 self-start whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{statusLabel(status)}</span>;
}

export function Money({ value }: { value: number }) {
  return <span>{formatMoney(value)}</span>;
}

export function ProgressBar({ accepted, ordered }: { accepted: number; ordered: number }) {
  const percent = ordered === 0 ? 0 : Math.min(100, Math.round((accepted / ordered) * 100));
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--px-blue)]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--px-muted)]">
        Ordered {ordered} · Delivered {accepted} ({percent}%)
      </p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-[var(--px-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-slate-400" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
};

export function createClient(baseUrl: string, getToken: () => string | null): ApiClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Request failed");
    }
    return body as T;
  }
  return {
    get: (path) => request(path),
    post: (path, payload) => request(path, { method: "POST", body: JSON.stringify(payload ?? {}) }),
    patch: (path, payload) => request(path, { method: "PATCH", body: JSON.stringify(payload ?? {}) }),
    put: (path, payload) => request(path, { method: "PUT", body: JSON.stringify(payload ?? {}) }),
  };
}
