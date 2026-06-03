# Tecnologias utilizadas no Origem Conecta

Este documento mostra, de forma simples, quais tecnologias foram usadas no Origem Conecta e para que cada uma serve dentro do projeto.

## Resumo geral

O Origem Conecta é uma plataforma online para conectar compradores e produtores. Ela funciona pelo navegador, pode ser acessada pelo celular e está sendo preparada para testes reais com usuários.

As principais partes do sistema são:

- tela do comprador;
- tela do produtor;
- painel administrativo;
- cadastro e login;
- portfólio de produtos;
- pedidos;
- cotações;
- estoque do produtor;
- fotos dos produtos;
- banco de dados online;
- hospedagem na internet.

## Tecnologias principais

| Parte | Tecnologia usada | Para que serve |
| --- | --- | --- |
| Site/aplicação | React | Criar as telas e botões do sistema |
| Organização do código | TypeScript | Evitar erros e deixar o projeto mais seguro |
| Navegação | TanStack Router | Controlar as páginas do sistema |
| Visual | Tailwind CSS | Criar o layout, cores, espaçamentos e responsividade |
| Componentes prontos | Radix UI | Criar campos, menus, abas, botões e janelas |
| Ícones | lucide-react | Usar ícones nos botões, menus e painéis |
| Banco de dados | Supabase | Guardar usuários, produtos, pedidos e estoque |
| Login e cadastro | Supabase Auth | Criar conta, entrar no sistema e controlar sessão |
| Fotos dos produtos | Supabase Storage | Guardar imagens enviadas pelos produtores |
| Hospedagem | Netlify | Deixar o sistema online para testes |
| Aplicativo no celular | PWA | Permitir instalar o site como se fosse um app |
| Build do projeto | Vite | Preparar o sistema para rodar localmente ou online |

## Parte visual do sistema

Usamos React, Tailwind CSS, Radix UI e lucide-react para montar toda a parte que o usuário vê e usa.

Isso inclui:

- telas de cadastro;
- tela de login;
- portfólio de produtos;
- carrinho e pedido;
- dashboard do comprador;
- dashboard do produtor;
- painel administrativo;
- botões;
- cards;
- filtros;
- menus;
- formulários;
- versão responsiva para celular.

## Cadastro e login

Usamos o Supabase Auth para controlar os usuários.

Hoje o sistema tem três tipos de perfil:

- comprador;
- produtor;
- administrador.

Cada tipo de usuário vê telas diferentes. Por exemplo, o comprador vê produtos e pedidos, o produtor vê estoque e pedidos recebidos, e o admin vê o painel geral da operação.

## Banco de dados

Usamos o Supabase como banco de dados online.

Ele guarda informações como:

- usuários cadastrados;
- dados dos compradores;
- dados dos produtores;
- produtos;
- estoque dos produtores;
- pedidos;
- itens dos pedidos;
- cotações;
- pedidos recorrentes;
- entregas;
- referências de mercado.

## Fotos dos produtos

Usamos o Supabase Storage para guardar as fotos que os produtores enviam.

O produtor pode cadastrar um produto no estoque, escolher uma foto e essa imagem aparece no portfólio para o comprador visualizar.

## Painel do comprador

O comprador consegue:

- ver o portfólio da semana;
- filtrar produtos;
- montar pedido;
- escolher produtos;
- ver histórico de compras;
- criar pedido recorrente;
- solicitar cotação;
- acompanhar pedidos;
- avaliar entrega;
- editar dados da empresa.

## Painel do produtor

O produtor consegue:

- fazer cadastro;
- informar o que produz ou fornece;
- cadastrar produtos no estoque;
- editar estoque;
- adicionar foto do produto;
- ver pedidos recebidos;
- responder cotações;
- acompanhar produtos mais vendidos;
- editar dados do perfil.

## Painel administrativo

O administrador consegue acompanhar a operação geral.

O painel mostra:

- pedidos criados;
- pedidos em andamento;
- produtos ativos;
- itens em estoque;
- produtores cadastrados;
- cotações abertas;
- valor em pedidos;
- alocação por produtor;
- dados gerais para controle da operação.

## Aplicativo no celular

O projeto também usa tecnologia PWA.

Isso permite que o usuário acesse pelo celular e instale o sistema na tela inicial, parecido com um aplicativo.

Foram adicionados:

- ícone do app;
- nome do app;
- arquivo de instalação;
- configuração para abrir em tela cheia;
- suporte básico para instalação no celular.

## Hospedagem

Estamos usando o Netlify para hospedar o sistema gratuitamente durante os testes.

O Netlify serve para:

- colocar o projeto online;
- gerar um link para compradores e produtores testarem;
- atualizar o sistema quando houver novas versões no GitHub.

## GitHub

O GitHub é usado para salvar o código do projeto.

Ele ajuda a:

- guardar o histórico das alterações;
- conectar o projeto com o Netlify;
- facilitar futuras atualizações;
- manter uma cópia segura do sistema.

## Ferramentas de desenvolvimento

Também usamos algumas ferramentas para manter o projeto organizado:

| Ferramenta | Para que serve |
| --- | --- |
| ESLint | Encontrar possíveis erros no código |
| Prettier | Organizar a formatação do código |
| npm | Instalar e rodar o projeto |
| Vite | Rodar o projeto localmente e gerar a versão final |

## Variáveis de configuração

O projeto usa algumas configurações importantes para se conectar ao Supabase e liberar o admin.

| Variável | Para que serve |
| --- | --- |
| `VITE_SUPABASE_URL` | Conecta o projeto ao Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública de acesso ao Supabase |
| `VITE_ADMIN_INVITE_CODE` | Código usado para criar conta de administrador |
| `NITRO_PRESET` | Configuração usada para hospedar no Netlify |

## Estrutura do projeto

De forma simples, o projeto está dividido assim:

| Pasta | O que tem dentro |
| --- | --- |
| `src/routes` | Telas e páginas do sistema |
| `src/components` | Botões, cards, menus e partes reutilizáveis |
| `src/lib` | Regras de login, pedidos, estoque e Supabase |
| `public` | Ícones, app mobile e arquivos públicos |
| `supabase/migrations` | Estrutura do banco de dados |
| `docs` | Documentos do projeto |

## Conclusão

O Origem Conecta usa tecnologias modernas para criar uma plataforma online, responsiva e pronta para testes reais.

De forma resumida:

- React cria as telas;
- Tailwind deixa o visual bonito e responsivo;
- Supabase guarda os dados e controla login;
- Supabase Storage guarda as fotos;
- Netlify coloca o sistema no ar;
- GitHub salva o código;
- PWA ajuda o sistema a funcionar melhor no celular.
