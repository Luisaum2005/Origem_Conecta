import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const producerMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/039_save_producer_signup_address.sql"),
  "utf8",
);
const buyerMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/038_order_delivery_address_and_producer_chat.sql"),
  "utf8",
);
const organizationMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/027_secure_multi_producer_orders.sql"),
  "utf8",
);

describe("persistência dos dados de cadastro", () => {
  it("salva os campos de endereço coletados do produtor", () => {
    expect(producerMigration).toContain("capture_producer_address_from_signup");
    expect(producerMigration).toContain("postal_code=v_postal_code");
    expect(producerMigration).toContain("address_line=v_address_line");
    expect(producerMigration).toContain("neighborhood=v_neighborhood");
  });

  it("salva o endereço do comprador e os dados institucionais da organização", () => {
    expect(buyerMigration).toContain("capture_buyer_address_from_signup");
    expect(organizationMigration).toContain("insert into public.organizations");
    expect(organizationMigration).toContain("responsible_name,responsible_role");
  });
});
