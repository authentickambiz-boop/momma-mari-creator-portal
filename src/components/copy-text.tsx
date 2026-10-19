"use client";

export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      className="btn ghost"
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
      }}
    >
      {label}
    </button>
  );
}
