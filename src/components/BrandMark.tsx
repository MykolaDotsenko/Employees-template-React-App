export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="presentation">
        <path className="brand-mark-horizon" d="M6 20.5h20" />
        <path
          className="brand-mark-dock"
          d="M9 25V11.5h5.25c5.45 0 8.75 2.7 8.75 6.75S19.7 25 14.25 25H9Z"
        />
        <circle className="brand-mark-sun" cx="23.5" cy="8.5" r="3.25" />
      </svg>
    </span>
  );
}
