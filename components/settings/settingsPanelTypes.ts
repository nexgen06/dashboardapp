import type { SettingsSection } from "@/contexts/settings-context";

export type SettingsPanelProps = {
  searchQuery: string;
  resetSection: (s: SettingsSection) => void;
  canResetSettings?: boolean;
};

export type GelismisAyarlarPanelProps = SettingsPanelProps & {
  resetToDefaults: () => void;
};
