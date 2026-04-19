import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '../../auth';

import { LoginButton } from './login-button';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage() {
  const session = await auth();
  if (session && !session.error) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">wesbot</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Entre com sua conta Discord para gerenciar seus servidores.
          </p>
        </div>
        <LoginButton />
      </div>
    </main>
  );
}
