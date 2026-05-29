param(
    [Parameter(Mandatory = $true)]
    [string]$ImageDir,

    [string]$ReportDir = ".\outputs\duplicate_audit",

    [string[]]$Extensions = @(".jpg", ".jpeg", ".png", ".bmp", ".webp")
)

$ErrorActionPreference = "Stop"

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    $resolved = Resolve-Path -LiteralPath $PathValue
    return $resolved.Path
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DirectoryPath
    )

    if (-not (Test-Path -LiteralPath $DirectoryPath)) {
        New-Item -ItemType Directory -Path $DirectoryPath | Out-Null
    }
}

function Normalize-Extensions {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Values
    )

    return $Values | ForEach-Object {
        $value = $_.Trim()
        if (-not $value.StartsWith(".")) {
            ".$value".ToLowerInvariant()
        }
        else {
            $value.ToLowerInvariant()
        }
    }
}

$absoluteImageDir = Resolve-AbsolutePath -PathValue $ImageDir
Ensure-Directory -DirectoryPath $ReportDir
$absoluteReportDir = (Resolve-Path -LiteralPath $ReportDir).Path
$normalizedExtensions = Normalize-Extensions -Values $Extensions

$files = Get-ChildItem -LiteralPath $absoluteImageDir -File |
    Where-Object { $normalizedExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName

if (-not $files) {
    throw "No image files found in $absoluteImageDir"
}

Write-Host "Scanning $($files.Count) files from $absoluteImageDir"

$hashRows = foreach ($file in $files) {
    $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm MD5
    [pscustomobject]@{
        Hash     = $hash.Hash
        FullName = $file.FullName
        Name     = $file.Name
        Length   = $file.Length
    }
}

$duplicateGroups = $hashRows |
    Group-Object Hash |
    Where-Object { $_.Count -gt 1 } |
    Sort-Object `
        @{ Expression = { $_.Count }; Descending = $true }, `
        @{ Expression = { $_.Name }; Descending = $false }

$candidateRows = New-Object System.Collections.Generic.List[object]
$groupIndex = 0

foreach ($group in $duplicateGroups) {
    $groupIndex += 1
    $members = $group.Group | Sort-Object FullName
    $keepPath = $members[0].FullName

    foreach ($member in $members) {
        $candidateRows.Add(
            [pscustomobject]@{
                GroupIndex = $groupIndex
                Hash       = $group.Name
                Keep       = ($member.FullName -eq $keepPath)
                Name       = $member.Name
                Path       = $member.FullName
                SizeBytes  = $member.Length
                Action     = if ($member.FullName -eq $keepPath) { "keep" } else { "review_remove" }
            }
        )
    }
}

$summary = [pscustomobject]@{
    image_dir              = $absoluteImageDir
    report_dir             = $absoluteReportDir
    total_images           = $files.Count
    duplicate_group_count  = $duplicateGroups.Count
    duplicate_file_count   = ($candidateRows | Measure-Object).Count
    suggested_remove_count = ($candidateRows | Where-Object { -not $_.Keep } | Measure-Object).Count
    extensions             = $normalizedExtensions
}

$summaryPath = Join-Path $absoluteReportDir "exact_duplicate_summary.json"
$csvPath = Join-Path $absoluteReportDir "exact_duplicate_candidates.csv"
$txtPath = Join-Path $absoluteReportDir "exact_duplicate_remove_list.txt"

$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$candidateRows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
($candidateRows | Where-Object { -not $_.Keep } | Select-Object -ExpandProperty Path) |
    Set-Content -LiteralPath $txtPath -Encoding UTF8

Write-Host ""
Write-Host "Duplicate group count : $($summary.duplicate_group_count)"
Write-Host "Duplicate file count  : $($summary.duplicate_file_count)"
Write-Host "Suggested removals    : $($summary.suggested_remove_count)"
Write-Host ""
Write-Host "Summary JSON : $summaryPath"
Write-Host "CSV report   : $csvPath"
Write-Host "Remove list  : $txtPath"
