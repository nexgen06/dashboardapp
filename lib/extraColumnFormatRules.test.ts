import { describe, expect, it } from "vitest";
import {
  getExtraColumnFormatKind,
  normalizeExtraDataBySmartRules,
} from "@/lib/extraColumnFormatRules";

describe("getExtraColumnFormatKind", () => {
  it("Mail Durumu akıllı çip sütunu e-posta formatına tabi değil", () => {
    expect(getExtraColumnFormatKind("Mail Durumu")).toBeNull();
  });

  it("durum sütunları e-posta formatına tabi değil", () => {
    expect(getExtraColumnFormatKind("E-posta Durumu")).toBeNull();
    expect(getExtraColumnFormatKind("Ödeme Durumu")).toBeNull();
  });

  it("doğrudan e-posta adresi sütunları formatlanır", () => {
    expect(getExtraColumnFormatKind("E-posta")).toBe("email");
    expect(getExtraColumnFormatKind("Eposta")).toBe("email");
    expect(getExtraColumnFormatKind("Mail Adresi")).toBe("email");
    expect(getExtraColumnFormatKind("email")).toBe("email");
  });
});

describe("normalizeExtraDataBySmartRules", () => {
  it("Mail Durumu çip etiketlerini reddetmez", () => {
    const result = normalizeExtraDataBySmartRules({ "Mail Durumu": "Mail gönderildi" });
    expect(result.errors).toHaveLength(0);
    expect(result.data?.["Mail Durumu"]).toBe("Mail gönderildi");
  });

  it("E-posta sütununda geçersiz adresi reddeder", () => {
    const result = normalizeExtraDataBySmartRules({ Eposta: "Mail gönderildi" });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("example@abc.com");
  });

  it("E-posta sütununda geçerli adresi normalleştirir", () => {
    const result = normalizeExtraDataBySmartRules({ "E-posta": "User@Example.COM" });
    expect(result.errors).toHaveLength(0);
    expect(result.data?.["E-posta"]).toBe("user@example.com");
  });
});
