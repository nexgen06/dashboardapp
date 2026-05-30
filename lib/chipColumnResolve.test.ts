import { describe, expect, it } from "vitest";
import {
  findPersistableChipOption,
  isLocalChipOptionId,
  matchChipOptionIdFromCellValue,
  resolveExtraColumnChip,
  type ChipCatalog,
  type ChipOption,
  type ChipTemplate,
} from "@/lib/chipSystem";

const emailTemplate: ChipTemplate = {
  id: "tpl-email",
  name: "E-posta",
  category: "email",
  description: null,
  icon: "check-circle",
  color: "cyan",
  isSystem: true,
  managerOnly: false,
  createdAt: "",
  updatedAt: "",
};

const emailOptions: ChipOption[] = [
  {
    id: "opt-1",
    templateId: "tpl-email",
    label: "Gönderilmedi",
    value: "not_sent",
    color: "slate",
    icon: "circle",
    sortOrder: 10,
    isTerminal: false,
  },
  {
    id: "opt-2",
    templateId: "tpl-email",
    label: "Mail gönderildi",
    value: "sent",
    color: "emerald",
    icon: "check",
    sortOrder: 30,
    isTerminal: true,
  },
];

function catalog(overrides?: Partial<ChipCatalog>): ChipCatalog {
  return {
    templates: [emailTemplate],
    options: emailOptions,
    bindings: [],
    ...overrides,
  };
}

describe("resolveExtraColumnChip", () => {
  it("Mail Durumu preset ile bağlantı olmadan çözümler", () => {
    const resolved = resolveExtraColumnChip(catalog(), ["proj-1"], "Mail Durumu");
    expect(resolved?.template.name).toBe("E-posta");
    expect(resolved?.options).toHaveLength(2);
  });

  it("select seçenekleri çip etiketleriyle eşleşince çözümler", () => {
    const resolved = resolveExtraColumnChip(catalog(), ["proj-1"], "E-posta Durumu", [
      "Gönderilmedi",
      "Mail gönderildi",
    ]);
    expect(resolved?.template.name).toBe("E-posta");
  });

  it("DB seçenekleri boşken select etiketlerinden sentetik çip üretir", () => {
    const resolved = resolveExtraColumnChip(
      catalog({ options: [] }),
      ["proj-1"],
      "Mail Durumu",
      ["Gönderilmedi", "Gönderim bekliyor", "Mail gönderildi", "Gönderilemedi"]
    );
    expect(resolved?.template.name).toBe("E-posta");
    expect(resolved?.options).toHaveLength(4);
    expect(resolved?.options[0]?.icon).toBe("circle");
    expect(resolved?.options[2]?.icon).toBe("check");
    expect(resolved?.options[0]?.id).toMatch(/^local:/);
  });

  it("DB ve select boşken Mail Durumu için varsayılan e-posta etiketlerini kullanır", () => {
    const resolved = resolveExtraColumnChip(catalog({ options: [] }), ["proj-1"], "Mail Durumu");
    expect(resolved?.options).toHaveLength(4);
    expect(resolved?.options.map((option) => option.label)).toEqual([
      "Gönderilmedi",
      "Gönderim bekliyor",
      "Mail gönderildi",
      "Gönderilemedi",
    ]);
  });
});

describe("matchChipOptionIdFromCellValue", () => {
  it("extra_data metninden option id eşleştirir", () => {
    expect(matchChipOptionIdFromCellValue("Mail Gönderildi", emailOptions, null)).toBe("opt-2");
  });
});

describe("local chip option helpers", () => {
  it("isLocalChipOptionId local: ile başlayan id'leri tanır", () => {
    expect(isLocalChipOptionId("local:tpl-email:0")).toBe(true);
    expect(isLocalChipOptionId("opt-1")).toBe(false);
  });

  it("findPersistableChipOption DB seçeneğini etiketle bulur", () => {
    const found = findPersistableChipOption(catalog(), "tpl-email", "Mail gönderildi");
    expect(found?.id).toBe("opt-2");
  });
});
