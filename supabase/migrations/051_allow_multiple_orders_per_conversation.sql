-- A conversation is a commercial relationship, not a single order. Each accepted
-- proposal retains its own order_id, allowing later proposals in the same chat.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.create_negotiation_proposal(uuid,jsonb,jsonb)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    '  if v_conversation.order_id is not null then raise exception ''Esta conversa já possui um pedido.''; end if;',
    ''
  );
  execute function_definition;

  select pg_get_functiondef(
    'public.accept_negotiation_proposal(uuid)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    '  if v_conversation.order_id is not null then raise exception ''Esta conversa já possui um pedido.''; end if;',
    ''
  );
  execute function_definition;
end $$;
