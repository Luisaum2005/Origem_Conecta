-- Add apiculture products to the central catalog. Products of animal origin
-- remain subject to the applicable inspection and commercialization rules.
insert into public.products(
  nome,
  categoria,
  unidade,
  descricao,
  ativo,
  status,
  normalized_name
)
values
  ('Mel','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel')),
  ('Mel Silvestre','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel Silvestre')),
  ('Mel de Laranjeira','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel de Laranjeira')),
  ('Mel de Eucalipto','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel de Eucalipto')),
  ('Mel de Assa-peixe','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel de Assa-peixe')),
  ('Mel em Favo','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Mel em Favo')),
  ('Extrato de Própolis','Mel e derivados','ml',null,true,'active',public.normalize_product_name('Extrato de Própolis')),
  ('Própolis in Natura','Mel e derivados','g',null,true,'active',public.normalize_product_name('Própolis in Natura')),
  ('Pólen Apícola','Mel e derivados','g',null,true,'active',public.normalize_product_name('Pólen Apícola')),
  ('Geleia Real','Mel e derivados','g',null,true,'active',public.normalize_product_name('Geleia Real')),
  ('Cera de Abelha','Mel e derivados','kg',null,true,'active',public.normalize_product_name('Cera de Abelha'))
on conflict do nothing;
