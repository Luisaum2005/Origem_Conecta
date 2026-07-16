# Sprint 4 — Notificações Push

## Implementado

- Central de notificações persistida no Supabase, com contador, leitura individual e “marcar todas”.
- Eventos de mensagem, pedido, resposta de demanda e avaliação são criados por triggers do banco; o frontend não escolhe destinatários.
- Web Push nativo com Service Worker, Push API, Notifications API e VAPID.
- Opt-in explícito nos perfis de comprador e produtor, sem solicitar permissão automaticamente.
- Vários dispositivos por usuário e desativação automática de endpoints expirados (HTTP 404/410).
- Falhas de push não interrompem a ação principal: o Database Webhook é assíncrono e a notificação interna permanece disponível.

## Configuração

1. Aplique `supabase/migrations/017_push_notifications.sql`.
2. Gere as chaves uma única vez: `npx web-push generate-vapid-keys`.
3. Coloque apenas a chave pública em `VITE_VAPID_PUBLIC_KEY` no ambiente do frontend.
4. Configure os secrets da função:
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... PUSH_WEBHOOK_SECRET=...`
5. Publique a função sem verificação JWT, pois a autenticação é feita pelo secret do webhook:
   `supabase functions deploy send-push-notification --no-verify-jwt`
6. No Supabase, em Database Webhooks, crie um webhook para `public.notifications`, evento `INSERT`, apontando para:
   `https://SEU_PROJECT_REF.supabase.co/functions/v1/send-push-notification`
   e envie o header `x-push-webhook-secret` com o mesmo valor de `PUSH_WEBHOOK_SECRET`.

## Teste real obrigatório

Use HTTPS (localhost também é aceito pelos navegadores), entre com dois usuários e:

1. Ative notificações no perfil do destinatário.
2. Com o app fechado ou em segundo plano, envie uma mensagem pelo outro usuário.
3. Confirme recebimento, título/corpo, clique abrindo a conversa correta e registro em `notifications` com `push_status = sent`.
4. Repita em Chrome/Edge Android. No iPhone/iPad, Web Push exige iOS/iPadOS 16.4+ e o site adicionado à Tela de Início; abas comuns do Safari não recebem Web Push.

O código fica pronto após os testes automatizados, mas a Sprint só deve ser marcada como concluída depois deste teste real em um dispositivo.
