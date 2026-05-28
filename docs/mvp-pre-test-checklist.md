# Origem Conecta - Checklist de teste do MVP

Use este roteiro antes de enviar o link para compradores e produtores reais.

## 1. Configuracao obrigatoria

- Criar projeto no Supabase.
- Rodar `supabase/migrations/001_initial_schema.sql` no SQL Editor do Supabase.
- Criar/confirmar o bucket publico `product-photos`.
- Configurar variaveis no deploy:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_INVITE_CODE`
- Criar a conta admin pela rota `/signup/admin`.
- Confirmar que o build passa com `npm run build`.

## 2. Teste como produtor

- Criar conta de produtor.
- Entrar no perfil do produtor.
- Editar dados da propriedade.
- Abrir estoque.
- Cadastrar produto com:
  - nome do produto;
  - quantidade;
  - unidade;
  - preco;
  - foto;
  - validade/observacoes.
- Pausar e reativar produto.
- Editar produto cadastrado.
- Confirmar que produto ativo aparece no portfolio do comprador.
- Abrir pedidos recebidos.
- Alterar status do pedido para:
  - Recebido;
  - Em separacao;
  - Em entrega;
  - Entregue.

## 3. Teste como comprador

- Criar conta de comprador.
- Entrar no portfolio.
- Buscar produto.
- Filtrar categoria.
- Adicionar produto ao pedido.
- Validar limite de estoque: nao deve permitir comprar acima do estoque.
- Escolher produtor manualmente quando houver opcao.
- Confirmar pedido.
- Conferir se o estoque baixou.
- Abrir meus pedidos.
- Acompanhar rastreio.
- Salvar pedido como recorrente.
- Recarregar pedido recorrente.
- Criar cotacao.
- Aprovar ou recusar cotacao respondida.

## 4. Teste como admin

- Entrar como admin.
- Ver painel geral.
- Ver pedidos em aberto.
- Alterar status de pedido.
- Ver estoque publicado.
- Ver cotacoes recentes.
- Editar referencias de mercado em `/quotes`.
- Testar botao de limpar dados locais apenas em ambiente de teste.

## 5. Teste mobile

- Abrir o link no celular.
- Testar cadastro de comprador.
- Testar cadastro de produtor.
- Testar upload de foto pela galeria/camera.
- Conferir menu inferior.
- Conferir botao flutuante "Ver pedido".
- Conferir se textos e botoes nao ficam cortados.
- Conferir cotações e tabelas com rolagem horizontal.

## 6. Observacoes para entrevistas

- Pedir para o usuario narrar onde ficou confuso.
- Medir se ele entendeu o papel de comprador/produtor.
- Perguntar se o cadastro de produto tem campos suficientes.
- Perguntar se escolher produtor manualmente faz sentido.
- Perguntar se o painel de pedidos do produtor ajuda na operacao.
- Perguntar se cotacao por CEASA/CONAB/CEPEA passa confianca.

## 7. Criterio minimo para liberar o link

- Build passando.
- Supabase conectado.
- Conta admin criada.
- Cadastro de comprador funcionando.
- Cadastro de produtor funcionando.
- Produto com foto aparecendo no portfolio.
- Pedido confirmando e baixando estoque.
- Produtor vendo pedido recebido.
- Status atualizando para comprador.
- App usavel no celular.
