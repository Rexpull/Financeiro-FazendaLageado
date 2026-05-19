import { describe, it, expect } from "vitest";
import { coerceMonetaryValue } from "./coerceMonetaryValue";

describe("coerceMonetaryValue", () => {
  it("keeps standard decimals", () => {
    expect(coerceMonetaryValue(-114.35)).toBe(-114.35);
    expect(coerceMonetaryValue(-1061.52)).toBe(-1061.52);
  });

  it("parses Caixa-style string amounts", () => {
    expect(coerceMonetaryValue("-1.061.52")).toBe(-1061.52);
  });

  it("does not truncate -1.061.52 to -1.061", () => {
    expect(coerceMonetaryValue("-1.061.52")).not.toBe(-1.061);
  });
});
