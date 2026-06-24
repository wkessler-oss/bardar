import bardarIcon from "@/assets/bardar-icon.png";

export function RadarBg({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{ background: "var(--gradient-radar)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[420px] blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle at 50% 0%, var(--primary), transparent 60%)" }}
      />
      {children}
    </div>
  );
}

export function RadarHeroMark({ size = 96 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span aria-hidden className="absolute inset-0 rounded-3xl radar-ping bg-primary/20" />
      <span aria-hidden className="absolute inset-2 rounded-3xl radar-ping bg-primary/30" style={{ animationDelay: "0.6s" }} />
      <img
        src={bardarIcon}
        alt="bardar"
        width={size}
        height={size}
        className="relative z-10 rounded-3xl shadow-[var(--shadow-glow)]"
      />
    </div>
  );
}