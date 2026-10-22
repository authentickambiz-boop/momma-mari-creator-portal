"use client";

import { useRef, useState } from "react";

const SIZES = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1200, height: 400 },
  pin: { width: 480, height: 270 },
} as const;

export function ProfileCrop({
  name,
  label,
  shape,
  existingSrc,
  removeName,
}: {
  name: string;
  label: string;
  shape: keyof typeof SIZES;
  existingSrc?: string | null;
  removeName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [ready, setReady] = useState(false);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(1);

  function paint(px: number, py: number, scale: number) {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const box = SIZES[shape];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = box.width;
    canvas.height = box.height;
    const base = Math.max(box.width / image.width, box.height / image.height) * scale;
    const dw = image.width * base;
    const dh = image.height * base;
    ctx.fillStyle = "#E7EEE8";
    ctx.fillRect(0, 0, box.width, box.height);
    ctx.drawImage(image, (box.width - dw) * (px / 100), (box.height - dh) * (py / 100), dw, dh);
  }

  function commit() {
    const canvas = canvasRef.current;
    const input = inputRef.current;
    if (!canvas || !input) return;
    canvas.toBlob((blob) => {
      if (!blob || !inputRef.current) return;
      const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }, "image/jpeg", 0.82);
  }

  function choose(file: File | undefined) {
    if (!file) return;
    setOriginalName(file.name);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
      setX(50);
      setY(50);
      setZoom(1);
      paint(50, 50, 1);
      commit();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  function move(nextX: number, nextY: number, nextZoom: number) {
    setX(nextX);
    setY(nextY);
    setZoom(nextZoom);
    paint(nextX, nextY, nextZoom);
    commit();
  }

  return (
    <div className={`member-crop member-crop-${shape}`}>
      <label>
        {label}
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      <input type="hidden" name={`${name}Name`} value={originalName} />
      {existingSrc && !ready ? <img src={existingSrc} alt="" /> : null}
      <canvas ref={canvasRef} hidden={!ready} aria-label={`${label} crop`} />
      {ready ? (
        <>
          <label>Across
            <input type="range" min={0} max={100} value={x} aria-label={`${label} across`} onChange={(event) => move(Number(event.target.value), y, zoom)} />
          </label>
          <label>Down
            <input type="range" min={0} max={100} value={y} aria-label={`${label} down`} onChange={(event) => move(x, Number(event.target.value), zoom)} />
          </label>
          <label>Zoom
            <input type="range" min={1} max={3} step={0.05} value={zoom} aria-label={`${label} zoom`} onChange={(event) => move(x, y, Number(event.target.value))} />
          </label>
          <button className="btn ghost" type="button" onClick={() => { paint(x, y, zoom); commit(); }}>Use this crop</button>
        </>
      ) : (
        <p className="note">Choose a photo, then slide it until the crop sits where you want.</p>
      )}
      {removeName ? <label><input type="checkbox" name={removeName} value="1" /> Remove this photo</label> : null}
    </div>
  );
}
