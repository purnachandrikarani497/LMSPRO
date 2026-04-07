# Run PowerShell as Administrator once so phones on the same LAN can reach the API.
# Usage:  cd backend ; .\scripts\allow_port_5000_windows.ps1

$ruleName = "LMSPRO API TCP 5000 (inbound)"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $ruleName" -ForegroundColor Green
    exit 0
}
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Private,Domain -ErrorAction Stop
Write-Host "Created: $ruleName (Private + Domain profiles)" -ForegroundColor Green
Write-Host "If the phone still cannot connect, also check Public profile or temporarily disable firewall to test." -ForegroundColor DarkYellow
