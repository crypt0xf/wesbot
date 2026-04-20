import { Music, Shield, Star, Ticket, Zap, BarChart3 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '../components/ui/button';

const features = [
  {
    icon: <Music className="h-5 w-5" />,
    title: 'Música de alta qualidade',
    description: 'Spotify, YouTube, Apple Music e Deezer via Lavalink. Filtros, autoplay e playlists salvas.',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Moderação completa',
    description: 'Warns, ban, timeout, automod com regex, anti-raid e logs detalhados.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Sistema de níveis',
    description: 'XP automático por mensagens, rank cards e recompensas de role por nível.',
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: 'Reaction roles',
    description: 'Roles automáticas por reação ou botão, com modos toggle, único e verificação.',
  },
  {
    icon: <Ticket className="h-5 w-5" />,
    title: 'Tickets',
    description: 'Sistema de suporte com transcrição, categorias e controles de staff.',
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Automação',
    description: 'Mensagens agendadas, comandos customizados e boas-vindas com imagem dinâmica.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="border-border/40 sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-lg">
              <Music className="text-primary h-4 w-4" />
            </div>
            <span className="font-bold">wesbot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Abrir painel</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="border-border/60 bg-card/50 text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
          <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
          Plataforma em desenvolvimento ativo
        </div>

        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          <span className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-transparent">
            wesbot
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-balance text-lg sm:text-xl">
          Bot de música e moderação para Discord com painel web completo. Gerencie seu servidor de onde estiver.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" clipRule="evenodd" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Entrar com Discord
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-muted-foreground mb-10 text-center text-sm font-semibold uppercase tracking-widest">
          Funcionalidades
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card border-border hover:border-primary/30 rounded-xl border p-6 transition-colors"
            >
              <div className="text-primary mb-3">{f.icon}</div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border/40 border-t py-6 text-center">
        <p className="text-muted-foreground text-xs">
          © 2026 wesbot · Desenvolvido por{' '}
          <a
            href="https://github.com/crypt0xf"
            className="hover:text-foreground transition-colors"
          >
            crypt0xf
          </a>{' '}
          · MIT License
        </p>
      </footer>
    </div>
  );
}
