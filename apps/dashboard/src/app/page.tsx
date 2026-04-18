export default function LandingPage() {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_50%)]"
      />
      <div className="max-w-2xl text-center">
        <span className="border-border/60 bg-card/50 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
          <span className="bg-primary h-1.5 w-1.5 rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
          Phase 0 · Scaffolding
        </span>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-transparent">
            wesbot
          </span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-balance text-lg">
          Plataforma Discord: música, moderação, níveis, tickets e automação — tudo operável do
          painel web.
        </p>
        <p className="text-muted-foreground/70 mt-10 text-xs uppercase tracking-[0.2em]">
          Em construção. A landing completa chega na Fase 5.
        </p>
      </div>
    </main>
  );
}
