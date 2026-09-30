# Dashboard Geração X

Dashboard analítico de mobilidade, veículos e soluções financeiras para pessoas de 45 a 61 anos em São Paulo.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Supabase

1. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em `.env.local`.
2. Execute `supabase/schema.sql` no SQL Editor do projeto Supabase.
3. A aplicação usa o SDK Supabase no frontend para contar respostas e salvar o formulário ao vivo.

A chave publishable pode ser usada no navegador com RLS habilitado. Nunca coloque a URL PostgreSQL ou a `service_role` key em variáveis `NEXT_PUBLIC_*`.