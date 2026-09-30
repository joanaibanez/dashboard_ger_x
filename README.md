# Dashboard Geração X

Dashboard analítico de mobilidade, veículos e soluções financeiras para pessoas de 45 a 61 anos em São Paulo.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Supabase

1. Configure em `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_DB_URL` (esta última só é usada localmente pelo script de importação).
2. Coloque o CSV exportado do Google Forms em `data/`.
3. `npm run db:reset` recria a tabela (`supabase/schema.sql`) e importa o CSV. Para só recarregar os dados: `npm run db:import`. **Ambos apagam as respostas existentes.**

Os indicadores (IDA, propensão a financiar, Readiness EV) e a elegibilidade (45–61 anos, município de SP) são calculados por trigger no banco — a mesma regra vale para a importação e para o formulário do painel. A leitura pública (RLS) expõe apenas respostas elegíveis.

A chave publishable pode ser usada no navegador com RLS habilitado. Nunca coloque a URL PostgreSQL ou a `service_role` key em variáveis `NEXT_PUBLIC_*`.

## Publicar no GitHub Pages

O Pages publica a raiz da branch `main`. Depois de `npm run build`, copie o conteúdo de `out/` para a raiz (mantendo o `.nojekyll`) e faça commit.
