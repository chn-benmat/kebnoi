export function PixelPal({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`pixel-pal relative h-[160px] w-[150px] [image-rendering:pixelated] ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      <span className="absolute top-[15px] left-[22px] h-10 w-8 border-[6px] border-(--color-blue-dark) bg-white" />
      <span className="absolute top-[15px] right-[22px] h-10 w-8 border-[6px] border-(--color-blue-dark) bg-white" />
      <span className="absolute top-8 left-[15px] h-[105px] w-[120px] border-[6px] border-(--color-blue-dark) bg-white shadow-[8px_8px_0_var(--color-blue)]">
        <span className="absolute top-[7px] left-10 h-[6px] w-7 bg-(--color-blue-dark)" />
        <span className="absolute top-[42px] left-[25px] h-3 w-[9px] bg-(--color-blue-dark)" />
        <span className="absolute top-[42px] right-[25px] h-3 w-[9px] bg-(--color-blue-dark)" />
        <span className="absolute top-[59px] left-3 h-[7px] w-[14px] bg-(--color-pink)" />
        <span className="absolute top-[59px] right-3 h-[7px] w-[14px] bg-(--color-pink)" />
        <span className="absolute top-16 left-12 h-[6px] w-3 bg-(--color-blue-dark)" />
      </span>
      <span className="absolute bottom-[11px] left-[26px] h-[14px] w-[30px] bg-(--color-blue-dark)" />
      <span className="absolute right-[19px] bottom-[11px] h-[14px] w-[30px] bg-(--color-blue-dark)" />
    </div>
  );
}
