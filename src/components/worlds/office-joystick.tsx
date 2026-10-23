"use client";

import { useRef } from "react";
import { stickFromDrag, type Stick } from "@/lib/worlds/office-move";

/** Touch joystick. Hidden on desktop from CSS. Dragging it does not reach the map. */
export function OfficeJoystick({
  stickRef,
  lifted,
}: {
  stickRef: React.MutableRefObject<Stick>;
  lifted: boolean;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  function place(clientX: number, clientY: number) {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    const radius = Math.max(1, rect.width / 2 - knob.offsetWidth / 2);
    const stick = stickFromDrag(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2),
      radius,
    );
    stickRef.current = stick;
    knob.style.transform = `translate(${stick.x * radius}px, ${-stick.y * radius}px)`;
  }

  function end(event?: { preventDefault: () => void; stopPropagation: () => void }) {
    event?.preventDefault();
    event?.stopPropagation();
    drag.current = false;
    stickRef.current = { x: 0, y: 0 };
    const knob = knobRef.current;
    if (!knob) return;
    knob.dataset.dragging = "false";
    knob.style.transform = "translate(0px, 0px)";
  }

  return (
    <div className={lifted ? "office-joystick is-lifted" : "office-joystick"}>
      <div
        ref={baseRef}
        className="office-joystick-base"
        role="group"
        aria-label="Move the camera"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = true;
          if (knobRef.current) knobRef.current.dataset.dragging = "true";
          place(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.preventDefault();
          event.stopPropagation();
          place(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          end(event);
        }}
        onPointerCancel={(event) => end(event)}
      >
        <div ref={knobRef} className="office-joystick-knob" data-dragging="false" />
      </div>
    </div>
  );
}
