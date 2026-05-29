param(
    [Parameter(Mandatory = $true)]
    [string]$ImageDir,

    [Parameter(Mandatory = $true)]
    [string]$OutputDir,

    [int]$MaxLongEdge = 1600,

    [ValidateRange(1, 100)]
    [int]$JpegQuality = 85,

    [switch]$Recurse,

    [string[]]$Extensions = @(".jpg", ".jpeg", ".png", ".bmp", ".webp")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DirectoryPath
    )

    if (-not (Test-Path -LiteralPath $DirectoryPath)) {
        New-Item -ItemType Directory -Path $DirectoryPath | Out-Null
    }
}

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    if (-not (Test-Path -LiteralPath $PathValue)) {
        throw "Path not found: $PathValue"
    }

    return (Resolve-Path -LiteralPath $PathValue).Path
}

function Get-JpegCodec {
    return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" } |
        Select-Object -First 1
}

function New-EncoderParameters {
    param(
        [Parameter(Mandatory = $true)]
        [long]$Quality
    )

    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParameter = New-Object System.Drawing.Imaging.EncoderParameter($encoder, $Quality)
    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParameters.Param[0] = $encoderParameter
    return $encoderParameters
}

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $baseUri = [System.Uri]((Resolve-Path -LiteralPath $BasePath).Path.TrimEnd('\') + '\')
    $targetUri = [System.Uri](Resolve-Path -LiteralPath $TargetPath).Path
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', '\')
}

function Get-ScaledSize {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Width,

        [Parameter(Mandatory = $true)]
        [int]$Height,

        [Parameter(Mandatory = $true)]
        [int]$MaxLongEdge
    )

    $longEdge = [Math]::Max($Width, $Height)
    if ($longEdge -le $MaxLongEdge) {
        return @{
            Width = $Width
            Height = $Height
            Resized = $false
        }
    }

    $scale = [double]$MaxLongEdge / [double]$longEdge
    return @{
        Width = [Math]::Max(1, [int][Math]::Round($Width * $scale))
        Height = [Math]::Max(1, [int][Math]::Round($Height * $scale))
        Resized = $true
    }
}

$absoluteImageDir = Resolve-AbsolutePath -PathValue $ImageDir
Ensure-Directory -DirectoryPath $OutputDir
$absoluteOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

$childParams = @{
    LiteralPath = $absoluteImageDir
    File = $true
}
if ($Recurse) {
    $childParams.Recurse = $true
}

$files = Get-ChildItem @childParams |
    Where-Object { $Extensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName

if (-not $files) {
    throw "No image files found in $absoluteImageDir"
}

$jpegCodec = Get-JpegCodec
if (-not $jpegCodec) {
    throw "JPEG encoder not available on this system."
}

$encoderParameters = New-EncoderParameters -Quality $JpegQuality
$stats = [ordered]@{
    source_dir = $absoluteImageDir
    output_dir = $absoluteOutputDir
    file_count = 0
    resized_count = 0
    source_bytes = 0
    output_bytes = 0
    max_long_edge = $MaxLongEdge
    jpeg_quality = $JpegQuality
}

$records = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $relativePath = Get-RelativePathCompat -BasePath $absoluteImageDir -TargetPath $file.FullName
    $relativeDir = [System.IO.Path]::GetDirectoryName($relativePath)
    $targetDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) {
        $absoluteOutputDir
    } else {
        Join-Path $absoluteOutputDir $relativeDir
    }
    Ensure-Directory -DirectoryPath $targetDir

    $targetName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".jpg"
    $targetPath = Join-Path $targetDir $targetName

    try {
        $sourceImage = [System.Drawing.Image]::FromFile($file.FullName)
    } catch {
        Write-Warning "Skip unreadable image: $($file.FullName)"
        continue
    }

    try {
        $scaled = Get-ScaledSize -Width $sourceImage.Width -Height $sourceImage.Height -MaxLongEdge $MaxLongEdge
        $bitmap = New-Object System.Drawing.Bitmap($scaled.Width, $scaled.Height)
        $bitmap.SetResolution($sourceImage.HorizontalResolution, $sourceImage.VerticalResolution)

        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.DrawImage($sourceImage, 0, 0, $scaled.Width, $scaled.Height)

        try {
            $bitmap.Save($targetPath, $jpegCodec, $encoderParameters)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }

        $outFile = Get-Item -LiteralPath $targetPath
        $stats.file_count += 1
        $stats.source_bytes += $file.Length
        $stats.output_bytes += $outFile.Length
        if ($scaled.Resized) {
            $stats.resized_count += 1
        }

        $records.Add([pscustomobject]@{
            source_path = $file.FullName
            output_path = $targetPath
            source_width = $sourceImage.Width
            source_height = $sourceImage.Height
            output_width = $scaled.Width
            output_height = $scaled.Height
            source_kb = [math]::Round($file.Length / 1KB, 2)
            output_kb = [math]::Round($outFile.Length / 1KB, 2)
            resized = $scaled.Resized
        }) | Out-Null
    } finally {
        $sourceImage.Dispose()
    }
}

$stats.compression_ratio = if ($stats.source_bytes -gt 0) {
    [math]::Round($stats.output_bytes / $stats.source_bytes, 4)
} else {
    0
}
$stats.saved_mb = [math]::Round(($stats.source_bytes - $stats.output_bytes) / 1MB, 2)

$reportDir = Join-Path $absoluteOutputDir "_compact_report"
Ensure-Directory -DirectoryPath $reportDir

$summaryPath = Join-Path $reportDir "summary.json"
$detailsPath = Join-Path $reportDir "details.csv"

([pscustomobject]$stats | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$records | Export-Csv -LiteralPath $detailsPath -NoTypeInformation -Encoding UTF8

Write-Host "Compacted files : $($stats.file_count)"
Write-Host "Resized files   : $($stats.resized_count)"
Write-Host "Saved MB        : $($stats.saved_mb)"
Write-Host "Output dir      : $absoluteOutputDir"
Write-Host "Summary         : $summaryPath"
