import { describe, expect, it } from "vitest";
import {
  collectAssignmentToasts,
  isNotificationPhase2Active,
  notificationToastDedupKey,
  shouldToastCentralNotification,
} from "@/lib/notificationPhase2";

describe("notificationPhase2", () => {
  it("detects full phase2 install", () => {
    expect(
      isNotificationPhase2Active({
        enqueue_notification: true,
        project_trigger: true,
        task_trigger: true,
        refresh_overdue_fn: true,
      })
    ).toBe(true);
    expect(
      isNotificationPhase2Active({
        enqueue_notification: true,
        project_trigger: true,
        task_trigger: false,
        refresh_overdue_fn: true,
      })
    ).toBe(false);
  });

  it("toasts only unread assignment types", () => {
    expect(
      shouldToastCentralNotification({ type: "task_assigned", read_at: null })
    ).toBe(true);
    expect(
      shouldToastCentralNotification({ type: "task_assigned", read_at: "2026-01-01" })
    ).toBe(false);
    expect(
      shouldToastCentralNotification({ type: "chat_unread", read_at: null })
    ).toBe(false);
  });

  it("dedupes by source_key and updated_at", () => {
    expect(
      notificationToastDedupKey({
        source_key: "task_assigned:1",
        updated_at: "2026-05-29T10:00:00Z",
      })
    ).toBe("task_assigned:1::2026-05-29T10:00:00Z");
  });

  it("skips toast on baseline then toasts new rows", () => {
    const seenKeys = new Set<string>();
    const existing = [
      {
        type: "task_assigned",
        title: "Eski",
        read_at: null,
        source_key: "task_assigned:a",
        updated_at: "2026-05-29T09:00:00Z",
      },
    ];
    const first = collectAssignmentToasts(existing, { baselineReady: false, seenKeys });
    expect(first.toToast).toHaveLength(0);
    expect(first.baselineReady).toBe(true);
    expect(seenKeys.size).toBe(1);

    const second = collectAssignmentToasts(
      [
        ...existing,
        {
          type: "task_assigned",
          title: "Yeni",
          read_at: null,
          source_key: "task_assigned:b",
          updated_at: "2026-05-29T10:00:00Z",
        },
      ],
      { baselineReady: first.baselineReady, seenKeys }
    );
    expect(second.toToast).toHaveLength(1);
    expect(second.toToast[0]?.title).toBe("Yeni");
  });
});
