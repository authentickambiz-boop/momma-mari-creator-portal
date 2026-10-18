"use client";

import { useState } from "react";
import { hostedEmailPreview } from "@/lib/email-setup";

export function HostedAddressField() {
  const [value, setValue] = useState("");
  const preview = hostedEmailPreview(value);
  return (
    <>
      <input
        name="hostedEmail"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="yourname"
        aria-label="Name for your mommamari.com address"
        autoComplete="off"
      />
      <span className="note">
        {preview ? `Your address will be ${preview}` : "Your address will be name@mommamari.com"}
      </span>
    </>
  );
}
