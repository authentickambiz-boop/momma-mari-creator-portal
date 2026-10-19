"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/app/actions";

export function AccountMenu({
  initials,
  items,
}: {
  initials: string;
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="account-menu">
      <button
        className="avatar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>
      {open ? (
        <div className="account-pop" role="menu">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" onClick={() => setOpen(false)}>
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
