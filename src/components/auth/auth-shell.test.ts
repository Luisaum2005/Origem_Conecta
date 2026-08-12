import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrimaryButton } from "@/components/auth/AuthShell";

describe("proteção dos formulários antes da hidratação", () => {
  it("mantém o botão principal desabilitado no HTML inicial", () => {
    const html = renderToStaticMarkup(createElement(PrimaryButton, null, "Entrar"));

    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain("Carregando...");
  });
});
