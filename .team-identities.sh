#!/bin/bash
# ─────────────────────────────────────────────
#  AssetFlow — Team Git Identity Switcher
#  Usage: source .team-identities.sh
#  Then call: as_smit / as_meshwa / as_ridham / as_pal
# ─────────────────────────────────────────────

as_smit() {
  git config user.name "Smit Prajapati"
  git config user.email "smitv208@gmail.com"
  echo "✅ Now committing as: Smit Prajapati"
}

as_meshwa() {
  git config user.name "Meshwa Patel"
  git config user.email "patelmeshwa869@gmail.com"
  echo "✅ Now committing as: Meshwa Patel"
}

as_ridham() {
  git config user.name "Ridham Patel"
  git config user.email "ridhampatel721@gmail.com"
  echo "✅ Now committing as: Ridham Patel"
}

as_pal() {
  git config user.name "Paintwithpal"
  git config user.email "paintwithpal@gmail.com"
  echo "✅ Now committing as: Paintwithpal"
}

echo "🚀 Team identities loaded. Use: as_smit | as_meshwa | as_ridham | as_pal"
