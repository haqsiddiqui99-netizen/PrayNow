# Run in PowerShell AS ADMINISTRATOR to allow phone access to Metro on port 8081
$port = 8081
$ruleName = "PrayNow Expo Metro $port"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $ruleName"
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
  Write-Host "Added firewall rule: allow inbound TCP $port"
}

Write-Host "Done. Restart 'npm start' and try Expo Go again."
