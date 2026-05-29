param(
    [Parameter(Mandatory = $true)]
    [string]$ImageDir,

    [string]$ReportDir = ".\outputs\similarity_audit",

    [string[]]$Extensions = @(".jpg", ".jpeg", ".png", ".bmp", ".webp"),

    [int]$HashSize = 8,

    [int]$MaxHammingDistance = 6
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

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

function Get-AverageHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImagePath,

        [Parameter(Mandatory = $true)]
        [int]$Side
    )

    $bitmap = [System.Drawing.Bitmap]::new($ImagePath)
    try {
        $thumb = [System.Drawing.Bitmap]::new($Side, $Side)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($thumb)
            try {
                $graphics.DrawImage($bitmap, 0, 0, $Side, $Side)
            }
            finally {
                $graphics.Dispose()
            }

            $values = New-Object System.Collections.Generic.List[int]
            $sum = 0

            for ($y = 0; $y -lt $Side; $y++) {
                for ($x = 0; $x -lt $Side; $x++) {
                    $pixel = $thumb.GetPixel($x, $y)
                    $gray = [int](0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B)
                    $values.Add($gray)
                    $sum += $gray
                }
            }

            $avg = $sum / $values.Count
            $chars = foreach ($value in $values) {
                if ($value -ge $avg) { "1" } else { "0" }
            }
            return (-join $chars)
        }
        finally {
            $thumb.Dispose()
        }
    }
    finally {
        $bitmap.Dispose()
    }
}

function Get-HammingDistance {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HashA,

        [Parameter(Mandatory = $true)]
        [string]$HashB
    )

    if ($HashA.Length -ne $HashB.Length) {
        throw "Hash length mismatch."
    }

    $distance = 0
    for ($i = 0; $i -lt $HashA.Length; $i++) {
        if ($HashA[$i] -ne $HashB[$i]) {
            $distance += 1
        }
    }
    return $distance
}

function Get-GreedyRepresentativeGroups {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Rows,

        [Parameter(Mandatory = $true)]
        [int]$DistanceThreshold
    )

    $groups = New-Object System.Collections.Generic.List[object]
    $used = New-Object 'bool[]' $Rows.Count

    $orderedIndices = 0..($Rows.Count - 1) | Sort-Object `
        @{ Expression = { $Rows[$_].Length }; Descending = $true }, `
        @{ Expression = { $Rows[$_].Name }; Descending = $false }

    foreach ($i in $orderedIndices) {
        if ($used[$i]) {
            continue
        }

        $group = New-Object System.Collections.Generic.List[int]
        $group.Add($i)
        $used[$i] = $true

        for ($j = 0; $j -lt $Rows.Count; $j++) {
            if ($used[$j] -or $j -eq $i) {
                continue
            }

            $distance = Get-HammingDistance -HashA $Rows[$i].Hash -HashB $Rows[$j].Hash
            if ($distance -le $DistanceThreshold) {
                $group.Add($j)
                $used[$j] = $true
            }
        }

        if ($group.Count -gt 1) {
            $groups.Add($group)
        }
    }

    return $groups
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

Write-Host "Computing image hashes for $($files.Count) files from $absoluteImageDir"

$hashRows = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $hashRows.Add(
        [pscustomobject]@{
            Name     = $file.Name
            FullName = $file.FullName
            Length   = $file.Length
            Hash     = Get-AverageHash -ImagePath $file.FullName -Side $HashSize
        }
    )
}

$groups = Get-GreedyRepresentativeGroups -Rows $hashRows.ToArray() -DistanceThreshold $MaxHammingDistance

$candidateRows = New-Object System.Collections.Generic.List[object]
$groupIndex = 0

foreach ($component in $groups) {
    $groupIndex += 1
    $members = $component | ForEach-Object { $hashRows[$_] }
    $keepRow = $members | Sort-Object @{ Expression = { $_.Length }; Descending = $true }, @{ Expression = { $_.Name }; Descending = $false } | Select-Object -First 1
    $keepPath = $keepRow.FullName

    foreach ($member in ($members | Sort-Object Name)) {
        $distanceToKeep = Get-HammingDistance -HashA $member.Hash -HashB $keepRow.Hash
        $candidateRows.Add(
            [pscustomobject]@{
                GroupIndex      = $groupIndex
                Keep            = ($member.FullName -eq $keepPath)
                Name            = $member.Name
                Path            = $member.FullName
                SizeBytes       = $member.Length
                DistanceToKeep  = $distanceToKeep
                Action          = if ($member.FullName -eq $keepPath) { "keep" } else { "review_remove" }
            }
        )
    }
}

$summary = [pscustomobject]@{
    image_dir                 = $absoluteImageDir
    report_dir                = $absoluteReportDir
    total_images              = $files.Count
    similar_group_count       = $groups.Count
    candidate_file_count      = ($candidateRows | Measure-Object).Count
    suggested_remove_count    = ($candidateRows | Where-Object { -not $_.Keep } | Measure-Object).Count
    hash_size                 = $HashSize
    max_hamming_distance      = $MaxHammingDistance
}

$summaryPath = Join-Path $absoluteReportDir "similar_image_summary.json"
$csvPath = Join-Path $absoluteReportDir "similar_image_candidates.csv"
$txtPath = Join-Path $absoluteReportDir "similar_image_remove_list.txt"

$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$candidateRows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
($candidateRows | Where-Object { -not $_.Keep } | Select-Object -ExpandProperty Path) |
    Set-Content -LiteralPath $txtPath -Encoding UTF8

Write-Host ""
Write-Host "Similar group count    : $($summary.similar_group_count)"
Write-Host "Candidate file count   : $($summary.candidate_file_count)"
Write-Host "Suggested removals     : $($summary.suggested_remove_count)"
Write-Host ""
Write-Host "Summary JSON : $summaryPath"
Write-Host "CSV report   : $csvPath"
Write-Host "Remove list  : $txtPath"
