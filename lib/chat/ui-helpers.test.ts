import { describe, expect, it } from "vitest";
import { extractServerErrorMessage, isGuardrailRefusal } from "./ui-helpers";

describe("extractServerErrorMessage", () => {
  it("extracts the error string from a valid { error } JSON body", () => {
    expect(extractServerErrorMessage('{"error":"quota exceeded"}')).toBe("quota exceeded");
  });

  it("returns undefined for a non-JSON string", () => {
    expect(extractServerErrorMessage("not json")).toBeUndefined();
  });

  it("returns undefined for valid JSON without an error field", () => {
    expect(extractServerErrorMessage('{"foo":"bar"}')).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(extractServerErrorMessage(undefined)).toBeUndefined();
  });
});

describe("isGuardrailRefusal", () => {
  it("ritorna true per frasi tipiche di rifiuto in italiano", () => {
    expect(
      isGuardrailRefusal("Non ho trovato questa informazione nella documentazione di Remote NIF.")
    ).toBe(true);
    expect(
      isGuardrailRefusal("Questa informazione non è presente nella documentazione.")
    ).toBe(true);
  });

  it("ritorna true per frasi tipiche di rifiuto in inglese", () => {
    expect(
      isGuardrailRefusal("I could not find this information in the Remote NIF documentation.")
    ).toBe(true);
  });

  it("ritorna false per risposte normali del corpus", () => {
    expect(
      isGuardrailRefusal("La gestione dei webhook in Remote NIF viene eseguita tramite Stripe...")
    ).toBe(false);
    expect(isGuardrailRefusal("")).toBe(false);
  });
});
