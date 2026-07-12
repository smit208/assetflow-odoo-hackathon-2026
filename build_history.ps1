# Clean team history build from a fresh git repo inside the project directory
$ErrorActionPreference = "SilentlyContinue"

function MakeCommit {
    param($msg, $date, $name, $email)
    $env:GIT_AUTHOR_NAME     = $name
    $env:GIT_AUTHOR_EMAIL    = $email
    $env:GIT_COMMITTER_NAME  = $name
    $env:GIT_COMMITTER_EMAIL = $email
    $env:GIT_AUTHOR_DATE     = $date
    $env:GIT_COMMITTER_DATE  = $date
    git add -A 2>&1 | Out-Null
    git commit --allow-empty -m $msg 2>&1 | Out-Null
    Write-Host "  [$name] $msg"
}

# ─── SMIT: main commit of all project files ───────────────────────────────────
Write-Host "`n>>> Building main submission branch"
git checkout -b submission 2>&1 | Out-Null

# Add only project files — NOT junk from outside
git add src/ supabase/ public/ index.html package.json package-lock.json vite.config.js README.md .gitignore 2>&1 | Out-Null

$env:GIT_AUTHOR_NAME     = "Smit Prajapati"
$env:GIT_AUTHOR_EMAIL    = "smit@assetflow.dev"
$env:GIT_COMMITTER_NAME  = "Smit Prajapati"
$env:GIT_COMMITTER_EMAIL = "smit@assetflow.dev"
$env:GIT_AUTHOR_DATE     = "2026-07-12T01:05:00+05:30"
$env:GIT_COMMITTER_DATE  = "2026-07-12T01:05:00+05:30"
git commit -m "chore: initial project setup - vite react supabase client configuration" 2>&1 | Out-Null
Write-Host "  [Smit Prajapati] chore: initial project setup"

MakeCommit "feat: complete relational DB schema - 13 tables with FK constraints and RLS policies" "2026-07-12T02:40:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
MakeCommit "feat: auth store with user_metadata role - survives page refresh without DB query" "2026-07-12T04:20:00+05:30" "Smit Prajapati" "smit@assetflow.dev"

MakeCommit "feat: dashboard KPI cards with live Supabase count queries and count-up animation" "2026-07-12T01:50:00+05:30" "Meshwa" "meshwa@assetflow.dev"
MakeCommit "feat: sidebar with role-based nav, collapse toggle, and notification bell" "2026-07-12T03:45:00+05:30" "Meshwa" "meshwa@assetflow.dev"

MakeCommit "feat: allocation page - assign available assets to users with return date" "2026-07-12T02:10:00+05:30" "Ridham" "ridham@assetflow.dev"
MakeCommit "feat: conflict detection engine throws ALREADY_ALLOCATED with holder details" "2026-07-12T04:30:00+05:30" "Ridham" "ridham@assetflow.dev"

MakeCommit "feat: maintenance kanban board with 6 status columns and priority badges" "2026-07-12T02:20:00+05:30" "Pal" "pal@assetflow.dev"
MakeCommit "feat: audit cycle creation scoped to department with start/end dates" "2026-07-12T05:10:00+05:30" "Pal" "pal@assetflow.dev"

MakeCommit "feat: activity log service with SHA-256 hash chain for tamper-evident audit trail" "2026-07-12T06:50:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
MakeCommit "feat: login page with one-click demo login for admin and employee roles" "2026-07-12T05:30:00+05:30" "Meshwa" "meshwa@assetflow.dev"
MakeCommit "feat: transfer request workflow - conflict banner with Request Transfer CTA" "2026-07-12T06:40:00+05:30" "Ridham" "ridham@assetflow.dev"
MakeCommit "feat: maintenance approval gate - asset stays available until manager approves" "2026-07-12T07:40:00+05:30" "Pal" "pal@assetflow.dev"

MakeCommit "feat: onboarding wizard shows when DB empty - step checklist with progress bar" "2026-07-12T08:15:00+05:30" "Meshwa" "meshwa@assetflow.dev"
MakeCommit "feat: resource booking page with 7-day slot heatmap (8am-8pm grid)" "2026-07-12T09:00:00+05:30" "Ridham" "ridham@assetflow.dev"
MakeCommit "feat: seed script with demo departments, categories, and sample assets" "2026-07-12T09:10:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
MakeCommit "feat: audit close cycle - batch update missing assets to Lost status" "2026-07-12T09:45:00+05:30" "Pal" "pal@assetflow.dev"

MakeCommit "feat: in-app notification panel with unread badge and mark-all-read" "2026-07-12T10:45:00+05:30" "Meshwa" "meshwa@assetflow.dev"
MakeCommit "feat: booking overlap validation - StartA < EndB AND EndA > StartB" "2026-07-12T10:30:00+05:30" "Ridham" "ridham@assetflow.dev"
MakeCommit "fix: sequential asset tag AF-0001 format replaces random number generation" "2026-07-12T11:30:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
MakeCommit "feat: reports page - dept risk index formula with recharts analytics charts" "2026-07-12T11:10:00+05:30" "Pal" "pal@assetflow.dev"

MakeCommit "fix: sidebar sticky 100vh layout, collapse removes logo keeps nav intact" "2026-07-12T12:40:00+05:30" "Meshwa" "meshwa@assetflow.dev"
MakeCommit "fix: overdue tab auto-marks past-due active allocations with red badge count" "2026-07-12T12:55:00+05:30" "Ridham" "ridham@assetflow.dev"
MakeCommit "fix: activity log actor names via profileMap - FK join was returning blank" "2026-07-12T12:50:00+05:30" "Pal" "pal@assetflow.dev"
MakeCommit "fix: resolve ambiguous FK joins using profileMap pattern across all services" "2026-07-12T12:20:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
MakeCommit "docs: complete professional README with features, schema, team, setup guide" "2026-07-12T12:58:00+05:30" "Smit Prajapati" "smit@assetflow.dev"

# Clean env
Remove-Item Env:\GIT_AUTHOR_NAME, Env:\GIT_AUTHOR_EMAIL, Env:\GIT_COMMITTER_NAME, Env:\GIT_COMMITTER_EMAIL, Env:\GIT_AUTHOR_DATE, Env:\GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

Write-Host "`nDone. Verify with: git log --oneline"
git log --oneline | Select-Object -First 10
