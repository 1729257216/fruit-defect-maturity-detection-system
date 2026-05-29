param(
    [Parameter(Mandatory = $true)]
    [string]$ImageDir,

    [Parameter(Mandatory = $true)]
    [string]$LabelDir,

    [string]$OutputRoot = ".\datasets\rotten_grade_det",

    [double]$TrainRatio = 0.8,

    [double]$ValRatio = 0.1,

    [int]$Seed = 42,

    [string[]]$ImageExtensions = @(".jpg", ".jpeg", ".png", ".bmp", ".webp"),

    [switch]$IncludeEmptyLabels,

    [switch]$OverwriteExisting
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

function Get-TargetImagePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseDir,

        [Parameter(Mandatory = $true)]
        [string]$Stem,

        [Parameter(Mandatory = $true)]
        [string[]]$Extensions
    )

    foreach ($extension in $Extensions) {
        $candidate = Join-Path $BaseDir ($Stem + $extension)
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Get-LabelObjectCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LabelPath
    )

    $count = 0
    foreach ($line in Get-Content -LiteralPath $LabelPath) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            $count += 1
        }
    }
    return $count
}

function Get-ClassCounts {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$LabelPaths
    )

    $counts = @{}
    foreach ($path in $LabelPaths) {
        foreach ($line in Get-Content -LiteralPath $path) {
            $trimmed = $line.Trim()
            if ([string]::IsNullOrWhiteSpace($trimmed)) {
                continue
            }
            $classId = ($trimmed -split "\s+")[0]
            if (-not $counts.ContainsKey($classId)) {
                $counts[$classId] = 0
            }
            $counts[$classId] += 1
        }
    }
    return $counts
}

$normalizedExtensions = Normalize-Extensions -Values $ImageExtensions
$absoluteImageDir = Resolve-AbsolutePath -PathValue $ImageDir
$absoluteLabelDir = Resolve-AbsolutePath -PathValue $LabelDir

Ensure-Directory -DirectoryPath $OutputRoot
$absoluteOutputRoot = (Resolve-Path -LiteralPath $OutputRoot).Path

$splitImageDirs = @{
    "train" = Join-Path $absoluteOutputRoot "images\train"
    "val"   = Join-Path $absoluteOutputRoot "images\val"
    "test"  = Join-Path $absoluteOutputRoot "images\test"
}

$splitLabelDirs = @{
    "train" = Join-Path $absoluteOutputRoot "labels\train"
    "val"   = Join-Path $absoluteOutputRoot "labels\val"
    "test"  = Join-Path $absoluteOutputRoot "labels\test"
}

foreach ($directory in ($splitImageDirs.Values + $splitLabelDirs.Values)) {
    Ensure-Directory -DirectoryPath $directory
}

if ($TrainRatio -le 0 -or $ValRatio -lt 0 -or ($TrainRatio + $ValRatio) -ge 1) {
    throw "TrainRatio must be > 0, ValRatio must be >= 0, and TrainRatio + ValRatio must be < 1."
}

if (-not $OverwriteExisting) {
    foreach ($directory in ($splitImageDirs.Values + $splitLabelDirs.Values)) {
        $existingFiles = Get-ChildItem -LiteralPath $directory -File
        if ($existingFiles) {
            throw "Target directory is not empty: $directory . Re-run with -OverwriteExisting if you want to replace files."
        }
    }
}

$labelFiles = Get-ChildItem -LiteralPath $absoluteLabelDir -File -Filter *.txt |
    Where-Object { $_.Name -ne "classes.txt" } |
    Sort-Object Name

if (-not $labelFiles) {
    throw "No label txt files found in $absoluteLabelDir"
}

$emptyLabels = New-Object System.Collections.Generic.List[string]
$missingImages = New-Object System.Collections.Generic.List[string]
$pairedItems = New-Object System.Collections.Generic.List[object]

foreach ($labelFile in $labelFiles) {
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($labelFile.Name)
    $imagePath = Get-TargetImagePath -BaseDir $absoluteImageDir -Stem $stem -Extensions $normalizedExtensions
    if (-not $imagePath) {
        $missingImages.Add($labelFile.FullName)
        continue
    }

    $objectCount = Get-LabelObjectCount -LabelPath $labelFile.FullName
    if ($objectCount -eq 0 -and -not $IncludeEmptyLabels) {
        $emptyLabels.Add($labelFile.FullName)
        continue
    }

    $pairedItems.Add(
        [pscustomobject]@{
            Stem       = $stem
            ImagePath  = $imagePath
            LabelPath  = $labelFile.FullName
            ObjectCount = $objectCount
        }
    )
}

if (-not $pairedItems) {
    throw "No matched image-label pairs available for staging."
}

$random = [System.Random]::new($Seed)
$shuffled = $pairedItems | Sort-Object { $random.Next() }

$total = $shuffled.Count
$trainCount = [Math]::Floor($total * $TrainRatio)
$valCount = [Math]::Floor($total * $ValRatio)
$testCount = $total - $trainCount - $valCount

$splitAssignments = @{}
$splitAssignments["train"] = @($shuffled | Select-Object -First $trainCount)
$splitAssignments["val"] = @($shuffled | Select-Object -Skip $trainCount -First $valCount)
$splitAssignments["test"] = @($shuffled | Select-Object -Skip ($trainCount + $valCount) -First $testCount)

foreach ($splitName in @("train", "val", "test")) {
    foreach ($item in $splitAssignments[$splitName]) {
        $imageDestination = Join-Path $splitImageDirs[$splitName] ([System.IO.Path]::GetFileName($item.ImagePath))
        $labelDestination = Join-Path $splitLabelDirs[$splitName] ([System.IO.Path]::GetFileName($item.LabelPath))

        Copy-Item -LiteralPath $item.ImagePath -Destination $imageDestination -Force:$OverwriteExisting
        Copy-Item -LiteralPath $item.LabelPath -Destination $labelDestination -Force:$OverwriteExisting
    }
}

$splitSummary = @{}
foreach ($splitName in @("train", "val", "test")) {
    $labelPaths = $splitAssignments[$splitName] | ForEach-Object { $_.LabelPath }
    $splitSummary[$splitName] = [pscustomobject]@{
        image_count   = $splitAssignments[$splitName].Count
        label_count   = $splitAssignments[$splitName].Count
        object_count  = (($splitAssignments[$splitName] | Measure-Object ObjectCount -Sum).Sum)
        class_counts  = Get-ClassCounts -LabelPaths $labelPaths
    }
}

$summary = [pscustomobject]@{
    image_dir                  = $absoluteImageDir
    label_dir                  = $absoluteLabelDir
    output_root                = $absoluteOutputRoot
    seed                       = $Seed
    train_ratio                = $TrainRatio
    val_ratio                  = $ValRatio
    test_ratio                 = [Math]::Round((1.0 - $TrainRatio - $ValRatio), 4)
    source_label_files         = $labelFiles.Count
    staged_pairs               = $pairedItems.Count
    skipped_empty_labels       = $emptyLabels.Count
    missing_image_for_label    = $missingImages.Count
    splits                     = $splitSummary
}

$reportDir = Join-Path $absoluteOutputRoot "staging_reports"
Ensure-Directory -DirectoryPath $reportDir
$summaryPath = Join-Path $reportDir "stage_dataset_summary.json"
$emptyPath = Join-Path $reportDir "skipped_empty_labels.txt"
$missingPath = Join-Path $reportDir "missing_images_for_labels.txt"

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$emptyLabels | Set-Content -LiteralPath $emptyPath -Encoding UTF8
$missingImages | Set-Content -LiteralPath $missingPath -Encoding UTF8

Write-Host "Staged pairs           : $($pairedItems.Count)"
Write-Host "Skipped empty labels   : $($emptyLabels.Count)"
Write-Host "Missing image matches  : $($missingImages.Count)"
Write-Host "Train / Val / Test     : $trainCount / $valCount / $testCount"
Write-Host "Summary JSON           : $summaryPath"
