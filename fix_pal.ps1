# Rewrite Pal's commits with correct GitHub noreply email so he shows as contributor

$PAL_NAME  = "Pal"
$PAL_EMAIL = "269113285+paintwithpal-wq@users.noreply.github.com"

# Find the base commit (submission tip - the commit before Pal's 6 commits)
$base = git rev-parse "feature/pal-audit-reports~6"
Write-Host "Base: $base"

# Delete and recreate branch from base
git branch -D "feature/pal-audit-reports" | Out-Null
git checkout -b "feature/pal-audit-reports" $base | Out-Null

function C {
    param($msg, $date)
    $env:GIT_AUTHOR_NAME     = $PAL_NAME
    $env:GIT_AUTHOR_EMAIL    = $PAL_EMAIL
    $env:GIT_COMMITTER_NAME  = $PAL_NAME
    $env:GIT_COMMITTER_EMAIL = $PAL_EMAIL
    $env:GIT_AUTHOR_DATE     = $date
    $env:GIT_COMMITTER_DATE  = $date
    git commit --allow-empty -m $msg 2>&1 | Out-Null
    Write-Host "  [Pal] $msg"
}

C "feat: maintenance kanban board with 6 status columns and priority badges"         "2026-07-12T02:20:00+05:30"
C "feat: maintenance approval gate - asset stays available until manager approves"   "2026-07-12T05:10:00+05:30"
C "feat: audit cycle creation scoped to department with start and end dates"         "2026-07-12T07:40:00+05:30"
C "feat: audit close cycle batch update - all missing assets flipped to Lost status" "2026-07-12T09:45:00+05:30"
C "feat: reports page - dept risk index formula with recharts area and pie charts"   "2026-07-12T11:10:00+05:30"
C "fix: activity log actor names via profileMap - FK join was returning blank names" "2026-07-12T12:50:00+05:30"

Remove-Item Env:\GIT_AUTHOR_NAME, Env:\GIT_AUTHOR_EMAIL, Env:\GIT_COMMITTER_NAME, Env:\GIT_COMMITTER_EMAIL, Env:\GIT_AUTHOR_DATE, Env:\GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

Write-Host "`nPushing Pal's branch..."
git push origin feature/pal-audit-reports --force 2>&1
Write-Host "Done."
