"use client";

import { useCallback, useMemo } from "react";
import type { Task } from "@/types/tasks";
import {
  parseSpotlightDescriptor,
  isSpotlightDescriptorActive,
  taskValueForSpotlight,
  normalizeSpotlightToken,
  type SpotlightDescriptor,
} from "@/components/tasks-table/spotlight";
import { ruleMatchesTask, type AutomationRule } from "@/lib/automationRules";
import type { ChipCatalog, RowChipValue } from "@/lib/chipSystem";

type ToastApi = { info: (msg: string) => void };

export type UseTasksTableSpotlightOptions = {
  automationRules: AutomationRule[];
  filteredData: Task[];
  chipCatalog: ChipCatalog;
  rowChipValues: RowChipValue[];
  spotlightEnabled: boolean;
  spotlightNowMs: number;
  toast: ToastApi;
};

export function useTasksTableSpotlight({
  automationRules,
  filteredData,
  chipCatalog,
  rowChipValues,
  spotlightEnabled,
  spotlightNowMs,
  toast,
}: UseTasksTableSpotlightOptions) {
  const spotlightRules = useMemo(
    () => automationRules.filter((rule) => rule.enabled && parseSpotlightDescriptor(rule).length > 0),
    [automationRules]
  );
  const spotlightRulesByPriority = useMemo(
    () =>
      [...spotlightRules].sort((a, b) => {
        const byPriority = (a.priority ?? 0) - (b.priority ?? 0);
        if (byPriority !== 0) return byPriority;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [spotlightRules]
  );
  const spotlightMatchByTaskId = useMemo(() => {
    const matches = new Map<string, {
      ruleId: string;
      ruleName: string;
      priority: number;
      descriptor: SpotlightDescriptor;
    }>();
    if (!spotlightEnabled || spotlightRulesByPriority.length === 0) return matches;
    for (const task of filteredData) {
      for (const rule of spotlightRulesByPriority) {
        if (!ruleMatchesTask(rule, task, { rowChipValues, catalog: chipCatalog })) continue;
        const descriptors = parseSpotlightDescriptor(rule).filter((descriptor) =>
          isSpotlightDescriptorActive(descriptor, spotlightNowMs)
        );
        if (descriptors.length === 0) continue;
        const matchedDescriptor = descriptors.find((descriptor) => {
          const value = normalizeSpotlightToken(taskValueForSpotlight(task, descriptor.columnKey));
          if (!value) return false;
          return descriptor.values.some((candidate) => normalizeSpotlightToken(candidate) === value);
        });
        if (!matchedDescriptor) continue;
        matches.set(task.id, {
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority ?? 0,
          descriptor: matchedDescriptor,
        });
        break;
      }
    }
    return matches;
  }, [chipCatalog, filteredData, rowChipValues, spotlightEnabled, spotlightNowMs, spotlightRulesByPriority]);
  const spotlightTaskIds = useMemo(
    () => new Set(Array.from(spotlightMatchByTaskId.keys())),
    [spotlightMatchByTaskId]
  );

  const spotlightActive = spotlightEnabled && spotlightTaskIds.size > 0;
  const spotlightRuleHitSummary = useMemo(() => {
    const counts = new Map<string, { ruleId: string; ruleName: string; priority: number; count: number }>();
    for (const match of Array.from(spotlightMatchByTaskId.values())) {
      const current = counts.get(match.ruleId);
      if (current) current.count += 1;
      else counts.set(match.ruleId, { ruleId: match.ruleId, ruleName: match.ruleName, priority: match.priority, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => {
      const byPriority = a.priority - b.priority;
      if (byPriority !== 0) return byPriority;
      return b.count - a.count;
    });
  }, [spotlightMatchByTaskId]);
  const spotlightSummary = useMemo(() => {
    if (!spotlightActive || spotlightRuleHitSummary.length === 0) return null;
    const dominantRule = spotlightRuleHitSummary[0];
    const dominantMatch = Array.from(spotlightMatchByTaskId.values()).find((match) => match.ruleId === dominantRule.ruleId) ?? null;
    if (!dominantMatch) return null;
    const first = dominantMatch.descriptor;
    let remainingLabel: string | null = null;
    if (first.endsAt) {
      const remainMs = new Date(first.endsAt).getTime() - spotlightNowMs;
      if (Number.isFinite(remainMs) && remainMs > 0) {
        const remainMin = Math.max(1, Math.ceil(remainMs / 60000));
        remainingLabel = remainMin >= 60
          ? `${Math.floor(remainMin / 60)}s ${remainMin % 60}dk`
          : `${remainMin}dk`;
      }
    }
    return {
      label: `${first.columnKey}: ${first.values.join(", ")}`,
      ruleName: dominantRule.ruleName,
      additionalRuleCount: Math.max(0, spotlightRuleHitSummary.length - 1),
      highlightedCount: spotlightTaskIds.size,
      remainingLabel,
    };
  }, [spotlightActive, spotlightMatchByTaskId, spotlightNowMs, spotlightRuleHitSummary, spotlightTaskIds.size]);

  const jumpToSpotlightRows = useCallback(() => {
    const target = document.querySelector('tr[data-spotlight-row="true"]');
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    toast.info("Mevcut görünümde spotlight satırı bulunamadı.");
  }, [toast]);

  return {
    spotlightMatchByTaskId,
    spotlightTaskIds,
    spotlightActive,
    spotlightSummary,
    jumpToSpotlightRows,
  };
}
