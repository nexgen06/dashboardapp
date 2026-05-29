import { describe, expect, it } from "vitest";
import {
  filterProjectActivities,
  getActivityTimeGroup,
  groupActivitiesByTime,
  type ProjectActivityItem,
} from "./projectActivityTimeline";

function sampleItem(overrides: Partial<ProjectActivityItem> = {}): ProjectActivityItem {
  return {
    id: "a1",
    actorName: "Ayşe",
    actorEmail: "ayse@example.com",
    actorKind: "user",
    actionType: "task_updated",
    taskLabel: "Ankara",
    taskSubtitle: "İl · Bölge A",
    recordId: "task-1",
    tableName: "tasks",
    summary: "Görev güncellendi",
    timestamp: new Date().toISOString(),
    changes: [],
    ...overrides,
  };
}

describe("getActivityTimeGroup", () => {
  const now = new Date(2026, 4, 29, 15, 0, 0);

  it("bugünkü kayıtları today grubuna koyar", () => {
    expect(getActivityTimeGroup(new Date(2026, 4, 29, 10, 0, 0), now)).toBe("today");
  });

  it("dünkü kayıtları yesterday grubuna koyar", () => {
    expect(getActivityTimeGroup(new Date(2026, 4, 28, 22, 0, 0), now)).toBe("yesterday");
  });

  it("daha eski kayıtları earlier grubuna koyar", () => {
    expect(getActivityTimeGroup(new Date(2026, 4, 20, 10, 0, 0), now)).toBe("earlier");
  });
});

describe("filterProjectActivities", () => {
  const now = new Date(2026, 4, 29, 15, 0, 0);
  const items: ProjectActivityItem[] = [
    sampleItem({
      id: "recent",
      actionType: "status_changed",
      taskLabel: "İstanbul",
      timestamp: new Date(2026, 4, 28, 12, 0, 0).toISOString(),
    }),
    sampleItem({
      id: "old",
      actionType: "task_created",
      taskLabel: "Adana",
      timestamp: new Date(2026, 3, 1, 12, 0, 0).toISOString(),
    }),
  ];

  it("actionType filtresini uygular", () => {
    const filtered = filterProjectActivities(items, {
      searchQuery: "",
      filterKind: "status_changed",
      dateFilter: "all",
      now,
    });
    expect(filtered.map((x) => x.id)).toEqual(["recent"]);
  });

  it("arama metnini görev etiketinde arar", () => {
    const filtered = filterProjectActivities(items, {
      searchQuery: "adana",
      filterKind: "all",
      dateFilter: "all",
      now,
    });
    expect(filtered.map((x) => x.id)).toEqual(["old"]);
  });

  it("7 günlük tarih filtresini uygular", () => {
    const filtered = filterProjectActivities(items, {
      searchQuery: "",
      filterKind: "all",
      dateFilter: "7d",
      now,
    });
    expect(filtered.map((x) => x.id)).toEqual(["recent"]);
  });
});

describe("groupActivitiesByTime", () => {
  const now = new Date(2026, 4, 29, 15, 0, 0);

  it("boş grupları sonuçtan çıkarır", () => {
    const sections = groupActivitiesByTime(
      [
        sampleItem({ id: "t1", timestamp: new Date(2026, 4, 29, 10, 0, 0).toISOString() }),
        sampleItem({ id: "y1", timestamp: new Date(2026, 4, 28, 10, 0, 0).toISOString() }),
      ],
      now
    );
    expect(sections.map((s) => s.group)).toEqual(["today", "yesterday"]);
    expect(sections[0]?.items).toHaveLength(1);
  });
});
