# AGENT.md - Origem Conecta

## Sobre o projeto

O Origem Conecta é uma plataforma B2B que conecta produtores rurais a compradores (restaurantes, mercados, hortifrutis, cozinhas industriais e distribuidores).

O objetivo é reduzir intermediários, facilitar a comercialização local e permitir negociações rápidas através de portfólio de produtos, demandas e pedidos.

Stack:

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Tailwind CSS
- shadcn/ui

---

# Filosofia

Sempre pense como um Engenheiro de Software Sênior.

Antes de modificar qualquer código:

- entenda o fluxo completo
- identifique impactos
- procure reutilizar componentes existentes
- mantenha consistência visual e arquitetural
- evite código duplicado

Nunca implemente apenas "o suficiente para funcionar".

Sempre entregue uma solução escalável.

---

# Arquitetura

Sempre considere que uma funcionalidade pode afetar:

- banco de dados
- RLS
- funções SQL
- triggers
- frontend
- páginas
- componentes
- hooks
- tipos TypeScript
- validações
- autenticação
- permissões

Antes de finalizar uma tarefa, verifique se todos os pontos acima foram considerados.

---

# Desenvolvimento

Sempre que criar uma funcionalidade:

## Backend

Verifique se precisa:

- nova tabela
- nova coluna
- índices
- foreign keys
- constraints
- enum
- função SQL
- trigger
- policies RLS
- bucket de storage
- edge function

## Frontend

Verifique se precisa:

- página
- componente
- modal
- formulário
- validações
- loading
- tratamento de erro
- estados vazios
- skeletons
- feedback visual
- toast

---

# Banco de Dados

Toda alteração estrutural deve gerar uma nova migration.

Local:

supabase/migrations/

Nome:

NNN_descricao.sql

Exemplo:

024_create_orders_table.sql

As migrations devem ser idempotentes sempre que possível utilizando:

- if exists
- if not exists
- create or replace
- drop policy if exists

Nunca altere migrations antigas.

Sempre crie uma nova migration.

---

# Segurança

Nunca desabilite RLS.

Sempre crie políticas específicas.

Sempre utilize auth.uid().

Evite políticas permissivas.

---

# Código

Sempre siga:

- Clean Code
- SOLID
- DRY
- KISS

Evite:

- código duplicado
- funções gigantes
- componentes enormes
- any no TypeScript

Prefira funções pequenas.

---

# Componentes

Antes de criar um componente novo:

Verifique se já existe um semelhante.

Se possível:

- reutilize
- extraia lógica para hooks
- mantenha consistência com shadcn/ui

---

# UI/UX

Sempre siga o design existente.

Prioridades:

- simplicidade
- mobile first
- acessibilidade
- boa hierarquia visual
- feedback para ações
- estados de loading
- estados vazios

---

# Performance

Sempre considere:

- memoização quando necessária
- consultas eficientes
- evitar re-renderizações
- paginação
- lazy loading quando fizer sentido

---

# Qualidade

Ao terminar uma tarefa, valide mentalmente:

✓ Existem erros de TypeScript?

✓ O lint continuará passando?

✓ O banco continua consistente?

✓ As policies funcionam?

✓ O frontend trata loading?

✓ Existe tratamento de erro?

✓ O fluxo funciona do início ao fim?

---

# Padrão de resposta

Antes de escrever código:

1. Explique rapidamente o plano.

Depois:

2. Implemente.

Ao finalizar:

3. Informe quais arquivos foram alterados.

4. Informe se existe migration.

5. Informe possíveis impactos.

---

# Objetivo

O foco do projeto é construir uma plataforma robusta, escalável e pronta para produção.

Sempre priorize qualidade, organização e manutenção futura em vez de soluções rápidas.
