import { describe, expect, it } from "vitest";
import { columnKeysEqual, renameKeyInStringList } from "@/lib/renameProjectExtraColumn";

describe("columnKeysEqual", () => {
  it("Türkçe büyük/küçük harf duyarsız karşılaştırır", () => {
    expect(columnKeysEqual("Mail Durumu", "mail durumu")).toBe(true);
    expect(columnKeysEqual(" İl ", "il")).toBe(true);
  });
});

describe("renameKeyInStringList", () => {
  it("eski anahtarı yeni adla değiştirir", () => {
    expect(renameKeyInStringList(["Risk", "Mail"], "Mail", "Mail Durumu")).toEqual([
      "Risk",
      "Mail Durumu",
    ]);
  });

  it("şemada yoksa yeni anahtarı ekler", () => {
    expect(renameKeyInStringList(["Risk"], "Mail", "Mail Durumu")).toEqual(["Risk", "Mail Durumu"]);
  });

  it("çakışan ada izin vermez", () => {
    expect(() => renameKeyInStringList(["Risk", "Mail Durumu"], "Risk", "Mail Durumu")).toThrow(
      /zaten var/
    );
  });
});
