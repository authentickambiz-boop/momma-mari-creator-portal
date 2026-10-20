export function BrandMark({ sub }: { sub: string }) {
  return (
    <span className="brand-mark">
      <span className="brand-m" aria-hidden="true">M</span>
      <span>
        <strong>Momma Mari</strong>
        <small>{sub}</small>
      </span>
    </span>
  );
}
