"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";
import { EMPTY_CHIP_CATALOG } from "@/components/tasks-table/constants";
import { supabase } from "@/lib/supabaseClient";
import { fetchSpotlightEnabledFromServer, SPOTLIGHT_ENABLED_APP_SETTINGS_KEY } from "@/lib/appSettingsSupabase";
import { listProjectColumns, type ProjectColumn } from "@/lib/projectColumns";
import { listReferenceSources, type ReferenceSource } from "@/lib/referenceSources";
import {
  buildChipValueResolver,
  listChipCatalog,
  listRowChipValues,
  type ChipCatalog,
  type RowChipValue,
} from "@/lib/chipSystem";
import {
  applyAutomationRulesForTasks,
  applyBuiltInOperationalRules,
  listAutomationRules,
  type AutomationRule,
} from "@/lib/automationRules";
import { listTaskAutomationStates, type TaskAutomationState } from "@/lib/taskAutomationState";
import {
  listMyProjectMemberPermissions,
  type ProjectMemberPermission,
} from "@/lib/projectMemberPermissions";

export type UseTasksTableDataLayerOptions = {
  projects: Project[];
  tasks: Task[];
  userId: string | null | undefined;
  canRunClientAutomations: boolean;
};

export function useTasksTableDataLayer({
  projects,
  tasks,
  userId,
  canRunClientAutomations,
}: UseTasksTableDataLayerOptions) {
  const [projectColumnsByProjectId, setProjectColumnsByProjectId] = useState<Record<string, ProjectColumn[]>>({});
  /** Referans kaynakları — extra column dropdown'ları için canlı veri kaynağı (config.reference.sourceId ile lookup). */
  const [referenceSources, setReferenceSources] = useState<ReferenceSource[]>([]);
  const [projectPermissionsByProjectId, setProjectPermissionsByProjectId] = useState<Record<string, ProjectMemberPermission>>({});
  const [projectPermissionsAvailable, setProjectPermissionsAvailable] = useState(false);
  const [chipCatalog, setChipCatalog] = useState<ChipCatalog>(EMPTY_CHIP_CATALOG);
  const [rowChipValues, setRowChipValues] = useState<RowChipValue[]>([]);
  const [rowAutomationStates, setRowAutomationStates] = useState<TaskAutomationState[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [spotlightEnabled, setSpotlightEnabled] = useState(true);
  const [spotlightNowMs, setSpotlightNowMs] = useState(() => Date.now());
  const automationApplyingRef = useRef(false);
  const automationRunKeyRef = useRef("");

  const chipResolver = useMemo(
    () => buildChipValueResolver(rowChipValues, chipCatalog),
    [rowChipValues, chipCatalog]
  );

  useEffect(() => {
    let cancelled = false;
    const ids = projects.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setProjectColumnsByProjectId({});
      return;
    }
    void (async () => {
      const entries = await Promise.all(ids.map(async (id) => [id, await listProjectColumns(id)] as const));
      if (cancelled) return;
      setProjectColumnsByProjectId(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  /** Referans kaynaklarını yükle (extra column dropdown'larında canlı bağlantı için). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const refs = await listReferenceSources();
        if (!cancelled) setReferenceSources(refs);
      } catch {
        // Sessiz başarısızlık — tablo yoksa boş referans listesi
        if (!cancelled) setReferenceSources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectIds = useMemo(
    () => Array.from(new Set(projects.map((project) => String(project.id ?? "")).filter(Boolean))),
    [projects]
  );
  const projectIdsKey = useMemo(() => projectIds.join(","), [projectIds]);
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const taskIdsKey = useMemo(() => taskIds.join(","), [taskIds]);
  const rowAutomationStateByTaskId = useMemo(
    () => new Map(rowAutomationStates.map((state) => [state.taskId, state])),
    [rowAutomationStates]
  );
  const hasTimedSpotlightRules = useMemo(
    () =>
      automationRules.some((rule) =>
        rule.enabled &&
        rule.actions.some((action) => {
          if (action.actionType !== "color_row") return false;
          if (!Boolean(action.payload?.spotlight)) return false;
          return Boolean(String(action.payload?.spotlightStartsAt ?? "").trim()) ||
            Boolean(String(action.payload?.spotlightEndsAt ?? "").trim());
        })
      ),
    [automationRules]
  );

  useEffect(() => {
    let cancelled = false;
    if (projectIds.length === 0) {
      setChipCatalog(EMPTY_CHIP_CATALOG);
      setAutomationRules([]);
      return;
    }
    void (async () => {
      try {
        const [nextCatalog, nextRules] = await Promise.all([
          listChipCatalog(projectIds),
          listAutomationRules(projectIds),
        ]);
        if (cancelled) return;
        setChipCatalog(nextCatalog);
        setAutomationRules(nextRules);
      } catch (err) {
        if (!cancelled) {
          console.warn("[live table operations]", err instanceof Error ? err.message : err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectIds]);

  useEffect(() => {
    if (projectIds.length === 0) return;
    const refreshCatalog = async () => {
      const nextCatalog = await listChipCatalog(projectIds);
      setChipCatalog(nextCatalog);
    };
    const channel = supabase
      .channel(`chip_catalog_live_table_${projectIdsKey}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_chip_bindings" }, () => {
        void refreshCatalog().catch((err) => console.warn("[live table chip bindings]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chip_options" }, () => {
        void refreshCatalog().catch((err) => console.warn("[live table chip options]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chip_templates" }, () => {
        void refreshCatalog().catch((err) => console.warn("[live table chip templates]", err instanceof Error ? err.message : err));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectIds, projectIdsKey]);

  useEffect(() => {
    let cancelled = false;
    const settingKey = SPOTLIGHT_ENABLED_APP_SETTINGS_KEY;
    void (async () => {
      const enabled = await fetchSpotlightEnabledFromServer().catch(() => null);
      if (cancelled || enabled == null) return;
      setSpotlightEnabled(Boolean(enabled));
    })();
    const channel = supabase
      .channel(`app_settings_${settingKey}_live_table`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${settingKey}`,
        },
        (payload) => {
          const row = payload.new as { value?: unknown } | null;
          if (!row) return;
          setSpotlightEnabled(row.value === true || row.value === "true" || row.value === 1 || row.value === "1");
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (projectIds.length === 0) return;
    const refreshRules = async () => {
      const nextRules = await listAutomationRules(projectIds);
      setAutomationRules(nextRules);
    };
    const channel = supabase
      .channel(`automation_rules_live_table_${projectIdsKey}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_rules" }, () => {
        void refreshRules().catch((err) => console.warn("[live table automation rules]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_actions" }, () => {
        void refreshRules().catch((err) => console.warn("[live table automation actions]", err instanceof Error ? err.message : err));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectIds, projectIdsKey]);

  useEffect(() => {
    let cancelled = false;
    if (taskIds.length === 0) {
      setRowChipValues([]);
      setRowAutomationStates([]);
      return;
    }
    void (async () => {
      try {
        const [rows, states] = await Promise.all([
          listRowChipValues(taskIds),
          listTaskAutomationStates(taskIds),
        ]);
        if (!cancelled) {
          setRowChipValues(rows);
          setRowAutomationStates(states);
        }
      } catch (err) {
        if (!cancelled) console.warn("[live table chips]", err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIds]);

  useEffect(() => {
    if (taskIds.length === 0) return;
    const refreshRowsAndStates = async () => {
      const [rows, states] = await Promise.all([listRowChipValues(taskIds), listTaskAutomationStates(taskIds)]);
      setRowChipValues(rows);
      setRowAutomationStates(states);
    };
    const channel = supabase
      .channel(`row_state_live_table_${taskIdsKey}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "row_chip_values" }, () => {
        void refreshRowsAndStates().catch((err) => console.warn("[live table row chips]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_automation_state" }, () => {
        void refreshRowsAndStates().catch((err) => console.warn("[live table task automation state]", err instanceof Error ? err.message : err));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskIds, taskIdsKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setSpotlightNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canRunClientAutomations || automationApplyingRef.current || tasks.length === 0 || chipCatalog.templates.length === 0) return;
    const spotlightTick = hasTimedSpotlightRules ? Math.floor(spotlightNowMs / 30000) : 0;
    const runKey = JSON.stringify({
      tasks: tasks.map((task) => [
        task.id,
        task.status,
        task.due_date,
        task.updated_at,
        task.extra_data,
      ]),
      chips: rowChipValues.map((value) => [
        value.taskId,
        value.templateId,
        value.optionId,
        value.updatedAt,
      ]),
      rules: automationRules.map((rule) => [rule.id, rule.enabled, rule.updatedAt]),
      spotlightTick,
    });
    if (automationRunKeyRef.current === runKey) return;
    automationRunKeyRef.current = runKey;

    let cancelled = false;
    automationApplyingRef.current = true;
    void (async () => {
      try {
        const builtInCount = await applyBuiltInOperationalRules(tasks, rowChipValues, chipCatalog);
        const customCount = await applyAutomationRulesForTasks(tasks, automationRules, chipCatalog);
        if (!cancelled && builtInCount + customCount > 0) {
          const [nextChipValues, nextAutomationStates] = await Promise.all([
            listRowChipValues(taskIds),
            listTaskAutomationStates(taskIds),
          ]);
          setRowChipValues(nextChipValues);
          setRowAutomationStates(nextAutomationStates);
        }
      } catch (err) {
        if (!cancelled) console.warn("[live table automation]", err instanceof Error ? err.message : err);
      } finally {
        automationApplyingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    automationRules,
    canRunClientAutomations,
    chipCatalog,
    hasTimedSpotlightRules,
    rowChipValues,
    spotlightNowMs,
    taskIds,
    tasks,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProjectPermissionsByProjectId({});
      setProjectPermissionsAvailable(false);
      return;
    }

    const loadPermissions = async () => {
      const result = await listMyProjectMemberPermissions();
      if (cancelled) return;
      if (!result.ok) {
        setProjectPermissionsByProjectId({});
        setProjectPermissionsAvailable(false);
        return;
      }
      setProjectPermissionsByProjectId(
        Object.fromEntries(result.data.map((permission) => [String(permission.project_id), permission]))
      );
      setProjectPermissionsAvailable(true);
    };

    void loadPermissions();
    const interval = window.setInterval(() => {
      void loadPermissions();
    }, 15000);
    const onFocus = () => {
      void loadPermissions();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadPermissions();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId]);

  return {
    projectColumnsByProjectId,
    referenceSources,
    projectPermissionsByProjectId,
    projectPermissionsAvailable,
    chipCatalog,
    rowChipValues,
    setRowChipValues,
    rowAutomationStates,
    automationRules,
    spotlightEnabled,
    spotlightNowMs,
    chipResolver,
    rowAutomationStateByTaskId,
    projectIds,
    taskIds,
  };
}
