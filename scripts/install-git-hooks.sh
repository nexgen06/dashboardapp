#!/usr/bin/env bash
# Git hook'larını .githooks/'ten .git/hooks/'a kopyalar veya
# core.hooksPath ile direkt bağlar. Yeni klona her geliştirici
# bir kez çalıştırır:
#   bash scripts/install-git-hooks.sh
#
# Husky gibi npm bağımlılığı eklemeden çalışan minimum çözüm.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "❌ Git deposu içinde değilsin."
  exit 1
fi

HOOKS_DIR="$REPO_ROOT/.githooks"
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ .githooks/ dizini yok ($HOOKS_DIR)"
  exit 1
fi

# core.hooksPath kullan — git native, hook'lar versiyon kontrolünde kalır
git config core.hooksPath .githooks

# Çalıştırılabilirlik
chmod +x "$HOOKS_DIR"/* 2>/dev/null || true

echo "✅ Git hook'ları kuruldu (core.hooksPath = .githooks)"
echo "   Aktif hook'lar:"
ls -1 "$HOOKS_DIR" | sed 's/^/     - /'
