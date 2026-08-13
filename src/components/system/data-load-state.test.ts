import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("estados compartilhados de consulta", () => {
  it("expoe a falha e uma acao de nova tentativa", () => {
    const html = renderToStaticMarkup(
      createElement(DataLoadError, {
        message: "Falha temporaria.",
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Falha temporaria.");
    expect(html).toContain("Tentar novamente");
  });

  it("identifica o carregamento como status acessivel", () => {
    const html = renderToStaticMarkup(createElement(DataLoading, { label: "Carregando pedidos" }));

    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando pedidos");
  });
});
