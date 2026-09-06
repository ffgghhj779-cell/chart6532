while ($true) {
    try {
        Invoke-RestMethod -Uri "https://chart6532.vercel.app/api/cron?key=7737655407" -Method Get
        Write-Host "BOMB DROPPED at $(Get-Date)"
    } catch {
        Write-Host "Failed to trigger: $_"
    }
    Start-Sleep -Seconds 1
}
