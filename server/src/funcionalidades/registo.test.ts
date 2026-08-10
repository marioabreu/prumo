import { describe, it, expect, vi } from "vitest";
import { semearFuncionalidades } from "./registo.js";

describe("semearFuncionalidades", () => {
  it("chama definir(chave, nome) para cada entrada do registo passado", async () => {
    const definir = vi.fn().mockResolvedValue(undefined);
    const registo = [
      { chave: "a", nome: "Feature A" },
      { chave: "b", nome: "Feature B" },
    ];

    await semearFuncionalidades({ funcionalidades: { definir } }, registo);

    expect(definir).toHaveBeenCalledTimes(2);
    expect(definir).toHaveBeenCalledWith("a", "Feature A");
    expect(definir).toHaveBeenCalledWith("b", "Feature B");
  });

  it("com o registo por defeito (vazio), não chama definir nenhuma vez", async () => {
    const definir = vi.fn().mockResolvedValue(undefined);
    await semearFuncionalidades({ funcionalidades: { definir } });
    expect(definir).not.toHaveBeenCalled();
  });
});
