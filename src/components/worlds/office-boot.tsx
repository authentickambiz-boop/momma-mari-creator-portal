import { officeBootStep, type OfficeBootStage } from "@/lib/worlds/office-boot";

type BootRoom = { id: string; x: number; z: number; w: number; d: number };

/** Floor-plan placeholder and a progress bar. The parent paints the full-screen plate. */
export function OfficeBoot({
  stage,
  rooms,
  message = "Opening the bot office…",
}: {
  stage: OfficeBootStage;
  rooms?: BootRoom[];
  message?: string;
}) {
  const step = officeBootStep(stage);
  const width = rooms?.reduce((max, room) => Math.max(max, room.x + room.w), 1) ?? 1;
  const depth = rooms?.reduce((max, room) => Math.max(max, room.z + room.d), 1) ?? 1;
  return (
    <div className="office-boot">
      <div className="office-skeleton" aria-hidden="true">
        {rooms && rooms.length ? (
          <svg viewBox={`0 0 ${width} ${depth}`}>
            {rooms.map((room) => (
              <rect key={room.id} x={room.x} y={room.z} width={room.w} height={room.d} />
            ))}
          </svg>
        ) : (
          <div className="office-skeleton-blocks">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <p>{message}</p>
      <div className="office-boot-bar" aria-hidden="true">
        <span style={{ width: `${step.progress}%` }} />
      </div>
      <p className="office-kicker">{step.label}</p>
    </div>
  );
}
