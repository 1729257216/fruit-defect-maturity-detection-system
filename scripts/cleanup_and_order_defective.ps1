param(
    [Parameter(Mandatory = $true)]
    [string]$ImageDir,

    [Parameter(Mandatory = $true)]
    [string]$LabelDir,

    [string]$PrefixFormat = "{0:D4}__",

    [string]$ReportDir = ".\outputs\defective_cleanup_order_report"
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

function Get-SortBucket {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseName
    )

    if ($BaseName -match '^[0-9]+$') {
        return 0
    }

    return 1
}

function Get-SortNumericValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseName
    )

    if ($BaseName -match '^[0-9]+$') {
        return [int64]$BaseName
    }

    return [int64]::MaxValue
}

$absoluteImageDir = Resolve-AbsolutePath -PathValue $ImageDir
$absoluteLabelDir = Resolve-AbsolutePath -PathValue $LabelDir
Ensure-Directory -DirectoryPath $ReportDir
$absoluteReportDir = (Resolve-Path -LiteralPath $ReportDir).Path

$imageFiles = Get-ChildItem -LiteralPath $absoluteImageDir -File
$labelFiles = Get-ChildItem -LiteralPath $absoluteLabelDir -File -Filter *.txt |
    Where-Object { $_.Name -ne "classes.txt" }

$labelMap = @{}
foreach ($label in $labelFiles) {
    $labelMap[$label.BaseName] = $label
}

$rows = foreach ($image in $imageFiles) {
    $hasLabel = $labelMap.ContainsKey($image.BaseName)
    $labelFile = if ($hasLabel) { $labelMap[$image.BaseName] } else { $null }
    $objectCount = if ($hasLabel) { Get-LabelObjectCount -LabelPath $labelFile.FullName } else { $null }

    [pscustomobject]@{
        ImageName      = $image.Name
        ImagePath      = $image.FullName
        BaseName       = $image.BaseName
        Extension      = $image.Extension
        HasLabel       = $hasLabel
        LabelPath      = if ($hasLabel) { $labelFile.FullName } else { $null }
        LabelName      = if ($hasLabel) { $labelFile.Name } else { $null }
        ObjectCount    = $objectCount
        IsEmptyLabel   = ($hasLabel -and $objectCount -eq 0)
        IsMatchedLabel = ($hasLabel -and $objectCount -gt 0)
    }
}

$removeRows = $rows | Where-Object { (-not $_.HasLabel) -or $_.IsEmptyLabel }
$matchedRows = $rows | Where-Object { $_.IsMatchedLabel } |
    Sort-Object `
        @{ Expression = { Get-SortBucket -BaseName $_.BaseName } }, `
        @{ Expression = { Get-SortNumericValue -BaseName $_.BaseName } }, `
        @{ Expression = { $_.BaseName.ToLowerInvariant() } }, `
        @{ Expression = { $_.Extension.ToLowerInvariant() } }

$imageBaseMap = @{}
foreach ($image in $imageFiles) {
    $imageBaseMap[$image.BaseName] = $image
}

$orphanLabels = $labelFiles | Where-Object { -not $imageBaseMap.ContainsKey($_.BaseName) } |
    Sort-Object Name

$mappingRows = New-Object System.Collections.Generic.List[object]
$emptyLabelPathsToDelete = New-Object System.Collections.Generic.List[string]
$removedImagePaths = New-Object System.Collections.Generic.List[string]

foreach ($row in $removeRows) {
    if (Test-Path -LiteralPath $row.ImagePath) {
        Remove-Item -LiteralPath $row.ImagePath -Force
        $removedImagePaths.Add($row.ImagePath)
    }

    if ($row.IsEmptyLabel -and $row.LabelPath -and (Test-Path -LiteralPath $row.LabelPath)) {
        Remove-Item -LiteralPath $row.LabelPath -Force
        $emptyLabelPathsToDelete.Add($row.LabelPath)
    }
}

$plannedTargets = @{}
$index = 1
foreach ($row in $matchedRows) {
    $prefix = $PrefixFormat -f $index
    $newImageName = $prefix + $row.ImageName
    $newLabelName = $prefix + $row.LabelName
    $newImagePath = Join-Path $absoluteImageDir $newImageName
    $newLabelPath = Join-Path $absoluteLabelDir $newLabelName

    if ((Test-Path -LiteralPath $newImagePath) -and ($newImagePath -ne $row.ImagePath)) {
        throw "Target image path already exists: $newImagePath"
    }
    if ((Test-Path -LiteralPath $newLabelPath) -and ($newLabelPath -ne $row.LabelPath)) {
        throw "Target label path already exists: $newLabelPath"
    }
    if ($plannedTargets.ContainsKey($newImageName) -or $plannedTargets.ContainsKey($newLabelName)) {
        throw "Planned target collision detected for prefix $prefix"
    }

    $plannedTargets[$newImageName] = $true
    $plannedTargets[$newLabelName] = $true

    $mappingRows.Add(
        [pscustomobject]@{
            sequence        = $index
            old_image_name  = $row.ImageName
            new_image_name  = $newImageName
            old_label_name  = $row.LabelName
            new_label_name  = $newLabelName
            object_count    = $row.ObjectCount
        }
    )
    $index += 1
}

foreach ($map in $mappingRows) {
    $oldImagePath = Join-Path $absoluteImageDir $map.old_image_name
    $tempImageName = "__tmp__" + $map.new_image_name
    Rename-Item -LiteralPath $oldImagePath -NewName $tempImageName

    $oldLabelPath = Join-Path $absoluteLabelDir $map.old_label_name
    $tempLabelName = "__tmp__" + $map.new_label_name
    Rename-Item -LiteralPath $oldLabelPath -NewName $tempLabelName
}

foreach ($map in $mappingRows) {
    $tempImagePath = Join-Path $absoluteImageDir ("__tmp__" + $map.new_image_name)
    Rename-Item -LiteralPath $tempImagePath -NewName $map.new_image_name

    $tempLabelPath = Join-Path $absoluteLabelDir ("__tmp__" + $map.new_label_name)
    Rename-Item -LiteralPath $tempLabelPath -NewName $map.new_label_name
}

$mappingCsvPath = Join-Path $absoluteReportDir "rename_mapping.csv"
$removedImagesPath = Join-Path $absoluteReportDir "removed_unlabeled_images.txt"
$removedEmptyLabelsPath = Join-Path $absoluteReportDir "removed_empty_labels.txt"
$orphanLabelsPath = Join-Path $absoluteReportDir "orphan_labels_without_defective_image.txt"
$summaryPath = Join-Path $absoluteReportDir "cleanup_summary.json"

$mappingRows | Export-Csv -LiteralPath $mappingCsvPath -NoTypeInformation -Encoding UTF8
$removedImagePaths | Set-Content -LiteralPath $removedImagesPath -Encoding UTF8
$emptyLabelPathsToDelete | Set-Content -LiteralPath $removedEmptyLabelsPath -Encoding UTF8
$orphanLabels.FullName | Set-Content -LiteralPath $orphanLabelsPath -Encoding UTF8

$summary = [pscustomobject]@{
    image_dir                      = $absoluteImageDir
    label_dir                      = $absoluteLabelDir
    report_dir                     = $absoluteReportDir
    removed_unlabeled_image_count  = $removeRows.Count
    removed_empty_label_count      = $emptyLabelPathsToDelete.Count
    renamed_matched_pair_count     = $mappingRows.Count
    orphan_label_count             = $orphanLabels.Count
}

$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Host "Removed unlabeled images : $($removeRows.Count)"
Write-Host "Removed empty labels     : $($emptyLabelPathsToDelete.Count)"
Write-Host "Renamed matched pairs    : $($mappingRows.Count)"
Write-Host "Orphan labels untouched  : $($orphanLabels.Count)"
Write-Host "Summary JSON             : $summaryPath"
