export type TakeoverVariant = "ready" | "nova" | "warning-1" | "warning-2" | "disqualified";

export function FullscreenTakeover({
  variant,
  children,
}: {
  variant: TakeoverVariant;
  children: React.ReactNode;
}) {
  return (
    <div className={`nova-takeover nova-takeover--${variant}`}>
      <div className="nova-takeover-content">{children}</div>
    </div>
  );
}
