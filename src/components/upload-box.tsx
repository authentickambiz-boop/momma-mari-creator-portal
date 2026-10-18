"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBasePath } from "@/lib/format";

export function UploadBox({
  dealId,
  brand,
  enabled,
  label,
}: {
  dealId: string;
  brand: string;
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationTag, setLocationTag] = useState("");

  async function send(file: File) {
    setError(null);
    setMessage(null);
    setDone(false);
    setProgress(0);
    const start = await fetch(withBasePath(`/api/deals/${dealId}/uploads`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "video/mp4",
        sizeBytes: file.size,
        caption,
        locationTag,
      }),
    });
    const started = await start.json();
    if (!start.ok) {
      setProgress(null);
      setError(started.error || "The upload didn't start.");
      return;
    }
    const chunkBytes = started.chunkBytes as number;
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + chunkBytes, file.size);
      const chunk = file.slice(offset, end);
      const response = await fetch(withBasePath(`/api/deals/${dealId}/uploads/${started.draftId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });
      const body = await response.json();
      if (!response.ok) {
        setProgress(null);
        setError(body.error || "A chunk didn't go through. You can try the file again.");
        return;
      }
      offset = end;
      setProgress(Math.round((offset / file.size) * 100));
      if (body.status === "complete") {
        setDone(true);
        setCaption("");
        setLocationTag("");
        setMessage(
          body.held
            ? "This draft is held for Kamron. It will not go to the brand until he clears it."
            : body.mode === "demo"
              ? "Recorded on the deal. Your manager can review it here. Drive isn't connected, so the video file itself was not stored."
              : "Saved in your Brand Drafts folder. Your manager will review it before it can go to the brand.",
        );
        router.refresh();
        return;
      }
    }
  }

  if (!enabled) {
    return (
      <div className="upload off">
        <b>No draft upload needed right now</b>
        <div className="note">This opens up once the deal is confirmed or the brand needs a draft.</div>
      </div>
    );
  }

  return (
    <div
      className={`upload ${done ? "done" : "idle"}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void send(file);
      }}
    >
      <div className="big">{done ? "✅" : "🎬"}</div>
      <b>{done ? `Draft received for ${brand}` : `${label} for ${brand}`}</b>
      <div className="note">
        Drag a video here or tap to choose. It&apos;s saved to your private {brand} folder, and your bot replies in the {brand} email thread only.
        A school logo, house number, location tag, or child&apos;s full name holds the draft for Kamron. The matched words are not saved.
      </div>
      <label className="stage-form" style={{ width: "100%" }}>
        Caption or on-screen text
        <textarea
          aria-label="Caption or on-screen text"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="What the video says"
        />
      </label>
      <label className="stage-form" style={{ width: "100%" }}>
        Location tag
        <input
          type="text"
          aria-label="Location tag"
          value={locationTag}
          onChange={(event) => setLocationTag(event.target.value)}
          placeholder="Leave blank if there is none"
        />
      </label>
      <label className="btn">
        Choose video
        <input
          type="file"
          accept="video/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void send(file);
            event.target.value = "";
          }}
        />
      </label>
      {progress !== null ? (
        <div className="progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      ) : null}
      {message ? <div className="note" style={{ marginTop: 8 }}>{message}</div> : null}
      {error ? <div className="note" style={{ marginTop: 8, color: "#a33a2a" }}>{error}</div> : null}
    </div>
  );
}
