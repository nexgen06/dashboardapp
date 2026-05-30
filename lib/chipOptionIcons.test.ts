import { describe, expect, it } from "vitest";
import { inferChipOptionIconSlug } from "@/lib/chipOptionIcons";

describe("inferChipOptionIconSlug", () => {
  it("mail durumları için farklı ikonlar", () => {
    expect(inferChipOptionIconSlug({ label: "Gönderilmedi", value: "not_sent" })).toBe("circle");
    expect(inferChipOptionIconSlug({ label: "Gönderim bekliyor", value: "pending" })).toBe("clock");
    expect(inferChipOptionIconSlug({ label: "Mail Gönderildi", value: "sent" })).toBe("check");
    expect(inferChipOptionIconSlug({ label: "Gönderilemedi", value: "failed" })).toBe("x-circle");
  });

  it("Gönderilemedi, Gönderildi ile karışmaz", () => {
    expect(inferChipOptionIconSlug({ label: "Gönderilemedi", value: "failed" })).not.toBe("check");
    expect(inferChipOptionIconSlug({ label: "Mail gönderildi", value: "sent" })).toBe("check");
    expect(inferChipOptionIconSlug({ label: "Mail Gönderildi", value: "mail_gönderildi" })).toBe("check");
  });
});
