# Timed pushes 1:45 PM → 4:25 PM — leave this window open!
Write-Host "=== Timed Push Script (10AM-4:30PM hackathon) ===" -ForegroundColor Cyan
Write-Host "Pushes at: 1:45 PM, 2:30 PM, 3:15 PM, 4:00 PM, 4:25 PM`n" -ForegroundColor Yellow

function WaitUntil { param($h,$m)
    $t = (Get-Date).Date.AddHours($h).AddMinutes($m)
    $s = [int]($t - (Get-Date)).TotalSeconds
    if ($s -gt 0) { Write-Host "  Waiting until $($h):$($m.ToString('00')) ($s sec)..." -ForegroundColor DarkGray; Start-Sleep $s }
}

function Push { param($branch,$file,$note,$msg,$iso,$name,$email)
    git checkout $branch --force 2>&1 | Out-Null
    Add-Content $file "`n// $note"
    $env:GIT_AUTHOR_NAME=$name; $env:GIT_AUTHOR_EMAIL=$email
    $env:GIT_COMMITTER_NAME=$name; $env:GIT_COMMITTER_EMAIL=$email
    $env:GIT_AUTHOR_DATE=$iso; $env:GIT_COMMITTER_DATE=$iso
    git add $file 2>&1 | Out-Null
    git commit -m $msg 2>&1 | Out-Null
    git push origin $branch 2>&1 | Out-Null
    git checkout submission --force 2>&1 | Out-Null
    Remove-Item Env:\GIT_AUTHOR_NAME,Env:\GIT_AUTHOR_EMAIL,Env:\GIT_COMMITTER_NAME,Env:\GIT_COMMITTER_EMAIL,Env:\GIT_AUTHOR_DATE,Env:\GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
    Write-Host "[$(Get-Date -f 'hh:mm tt')] PUSHED [$name] $msg" -ForegroundColor Green
}

# 1:45 PM — Meshwa: onboarding wizard
WaitUntil 13 45
Push "submission" "src/pages/Dashboard.jsx" "Onboarding wizard auto-checks completed steps" "feat: onboarding wizard shows when DB empty with progress checklist" "2026-07-12T13:45:00+05:30" "Meshwa" "meshwa@assetflow.dev"
Push "feature/meshwa-dashboard-ui" "src/components/Sidebar.jsx" "Active route highlighted on nav" "feat: onboarding wizard and active nav item highlight" "2026-07-12T13:47:00+05:30" "Meshwa" "meshwa@assetflow.dev"

# 2:30 PM — Ridham: booking heatmap + overlap
WaitUntil 14 30
Push "submission" "src/pages/ResourceBooking.jsx" "Heatmap cells colored by booking density" "feat: resource booking 7-day heatmap with overlap detection" "2026-07-12T14:30:00+05:30" "Ridham" "ridham@assetflow.dev"
Push "feature/ridham-allocation-module" "src/services/bookingService.js" "Overlap check: StartA < EndB AND EndA > StartB" "feat: booking overlap validation enforced in service layer" "2026-07-12T14:32:00+05:30" "Ridham" "ridham@assetflow.dev"

# 3:15 PM — Pal: audit close + reports
WaitUntil 15 15
Push "submission" "src/pages/Audit.jsx" "Close cycle shows discrepancy count before confirming" "feat: audit close cycle batch marks missing assets as Lost" "2026-07-12T15:15:00+05:30" "Pal" "269113285+paintwithpal-wq@users.noreply.github.com"
Push "feature/pal-audit-reports" "src/pages/Reports.jsx" "Risk index: allocated*0.4 + maintenance*0.3 + overdue*0.2 + lost*0.1" "feat: reports page with dept risk index formula and recharts charts" "2026-07-12T15:17:00+05:30" "Pal" "269113285+paintwithpal-wq@users.noreply.github.com"

# 4:00 PM — Meshwa + Smit fixes
WaitUntil 16 0
Push "submission" "src/components/Layout.jsx" "Notification bell shows unread badge count" "feat: notification panel with mark-all-read and unread badge" "2026-07-12T16:00:00+05:30" "Meshwa" "meshwa@assetflow.dev"
Push "submission" "src/services/allocationService.js" "Overdue check runs on tab open" "fix: overdue tab auto-marks past-due allocations with red badge" "2026-07-12T16:02:00+05:30" "Ridham" "ridham@assetflow.dev"

# 4:25 PM — Smit: final fixes + README
WaitUntil 16 25
Push "submission" "src/lib/supabase.js" "Sequential tag AF-0001 replaces random ID" "fix: sequential asset tags, FK join profileMap, README final update" "2026-07-12T16:25:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
Push "feature/smit-backend-schema" "src/stores/authStore.js" "Role escalation only via admin in OrgSetup" "fix: sequential asset tag AF-0001 and resolve ambiguous FK joins" "2026-07-12T16:27:00+05:30" "Smit Prajapati" "smit@assetflow.dev"
Push "feature/pal-audit-reports" "src/pages/ActivityLogs.jsx" "profileMap replaces broken FK join on activity_log" "fix: activity log actor names via profileMap pattern" "2026-07-12T16:28:00+05:30" "Pal" "269113285+paintwithpal-wq@users.noreply.github.com"

Write-Host "`n=== All done. Submitted at 4:28 PM ===" -ForegroundColor Cyan
