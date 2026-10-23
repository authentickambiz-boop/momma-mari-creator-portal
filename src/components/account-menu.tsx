"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/actions";

export function AccountMenu({
  initials,
  items,
}: {
  initials: string;
  items: { href: string; label: string; newTab?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <div className="account-menu" ref={menu}>
      <button
        className="avatar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>
      {open ? (
        <div className="account-pop" id={menuId} role="menu">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="signout" type="submit" role="menuitem">Sign out</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
