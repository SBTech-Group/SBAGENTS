# Copia os agentes do SBAGENTS para o Claude Code do usuário (%USERPROFILE%\.claude\agents).
# Rode de novo sempre que algo em agents\ mudar.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $env:USERPROFILE ".claude\agents"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Get-ChildItem -Path (Join-Path $root "agents") -Directory | ForEach-Object {
    $src = Join-Path $_.FullName "prompt.md"
    if (Test-Path $src) {
        $target = Join-Path $dest ($_.Name + ".md")
        Copy-Item -Path $src -Destination $target -Force
        Write-Host "instalado: $($_.Name) -> $target"
    }
}
Write-Host "Pronto. Abra o Claude Code e confira com /agents."
