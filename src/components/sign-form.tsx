"use client";

import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { countersignContractAction, signContractAction } from "@/app/actions";
import { ESIGN_CONSENT_LABEL, READ_CONSENT_LABEL } from "@/lib/sign-copy";

export function SignForm({
  mode,
  dealId,
  contractId,
  creatorId,
  guardianLabel,
  error,
}: {
  mode: "sign" | "countersign";
  dealId: string;
  contractId: string;
  creatorId: string;
  guardianLabel: string | null;
  error: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [kind, setKind] = useState<"typed" | "drawn">("typed");
  const [localError, setLocalError] = useState<string | null>(null);
  const action = mode === "countersign" ? countersignContractAction : signContractAction;

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveDraw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function padIsBlank() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return true;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return false;
    }
    return true;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    setLocalError(null);
    if (kind !== "drawn") return;
    if (padIsBlank()) {
      event.preventDefault();
      setLocalError("Draw your signature, or switch to a typed signature.");
      return;
    }
    const hidden = event.currentTarget.querySelector<HTMLInputElement>("input[name=signaturePng]");
    if (hidden && canvasRef.current) hidden.value = canvasRef.current.toDataURL("image/png");
  }

  return (
    <form action={action} className="wizard" onSubmit={onSubmit}>
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="contractId" value={contractId} />
      {mode === "countersign" && creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
      <input type="hidden" name="signaturePng" value="" />
      <label className="check">
        <input type="checkbox" name="consentEsign" value="1" />
        {ESIGN_CONSENT_LABEL}
      </label>
      <label className="check">
        <input type="checkbox" name="consentRead" value="1" />
        {READ_CONSENT_LABEL}
      </label>
      {guardianLabel ? (
        <label className="check">
          <input type="checkbox" name="guardianConfirm" value="1" />
          {guardianLabel}
        </label>
      ) : null}
      <label>
        Full legal name
        <input type="text" name="legalName" autoComplete="name" aria-label="Full legal name" required />
      </label>
      <fieldset>
        <legend>Signature</legend>
        <label className="check">
          <input type="radio" name="signatureKind" value="typed" checked={kind === "typed"} onChange={() => setKind("typed")} />
          Type my name as the signature
        </label>
        <label className="check">
          <input type="radio" name="signatureKind" value="drawn" checked={kind === "drawn"} onChange={() => setKind("drawn")} />
          Draw my signature
        </label>
      </fieldset>
      {kind === "drawn" ? (
        <div>
          <canvas
            ref={canvasRef}
            className="sign-pad"
            width={640}
            height={200}
            aria-label="Draw your signature"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <button className="btn ghost" type="button" onClick={clearPad}>Clear</button>
        </div>
      ) : null}
      {error ? <p className="note">{error}</p> : null}
      {localError ? <p className="note">{localError}</p> : null}
      <div className="wizard-actions">
        <button className="btn" type="submit">{mode === "countersign" ? "Countersign" : "Sign"}</button>
      </div>
    </form>
  );
}
