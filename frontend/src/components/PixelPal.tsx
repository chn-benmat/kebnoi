export function PixelPal({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "pixel-pal small" : "pixel-pal"} aria-hidden="true">
      <span className="pal-ear left" />
      <span className="pal-ear right" />
      <span className="pal-body">
        <span className="pal-slot" />
        <span className="pal-eye left" />
        <span className="pal-eye right" />
        <span className="pal-blush left" />
        <span className="pal-blush right" />
        <span className="pal-mouth" />
      </span>
      <span className="pal-foot left" />
      <span className="pal-foot right" />
    </div>
  );
}
