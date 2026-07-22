# Web Push: configuração reproduzível

O Web Push usa duas configurações separadas:

- Frontend/Vercel: `VITE_VAPID_PUBLIC_KEY`.
- Edge Function/Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `PUSH_WEBHOOK_SECRET`.

## Publicação

1. Configure os secrets da função:

   ```powershell
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... PUSH_WEBHOOK_SECRET=...
   ```

2. Publique a função:

   ```powershell
   npx supabase functions deploy send-push-notification --no-verify-jwt
   ```

3. Na Vercel, configure `VITE_VAPID_PUBLIC_KEY` para Produção e Prévia e faça um novo deploy.

4. Desative ou exclua o Database Webhook de `notifications` criado manualmente pelo Dashboard.

5. Abra `supabase/setup_push_webhook.sql`, substitua os dois placeholders e execute o arquivo no SQL Editor. O segredo fica no Supabase Vault, não em tabelas públicas.

## Diagnóstico

Confirme que o navegador criou uma inscrição:

```sql
select user_id,is_active,failure_count,last_success_at,last_failure_at,updated_at
from public.push_subscriptions
order by updated_at desc;
```

Confirme a tentativa da função:

```sql
select title,push_status,push_attempt_count,push_last_error,push_attempted_at,created_at
from public.notifications
order by created_at desc
limit 20;
```

Estados esperados: `sent` quando ao menos um dispositivo recebeu; `partial` quando apenas alguns receberam; `skipped` quando o usuário não possui inscrição ativa ou desativou aquela categoria.
