$files = Get-ChildItem -Path "src" -Recurse -Include "*.jsx","*.js"
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    $cleaned = $content -replace [char]0x2014, ''
    [System.IO.File]::WriteAllText($f.FullName, $cleaned, [System.Text.Encoding]::UTF8)
}
Write-Host "Done - removed em dashes from $($files.Count) files"
