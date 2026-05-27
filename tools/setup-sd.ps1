# BoatOS SD-Card Setup
# Fuegt WiFi-Konfiguration zur geflashten SD-Karte hinzu.
# Ausfuehren NACH dem Flashen mit Raspberry Pi Imager, BEVOR die SD-Karte in den Pi kommt.
#
# Verwendung:
#   .\setup-sd.ps1
#   .\setup-sd.ps1 -SSID "MeinNetz" -Password "meinpasswort"
#   .\setup-sd.ps1 -Drive D:

param(
    [string]$Drive = "",
    [string]$SSID = "",
    [string]$Password = "",
    [string]$Country = "DE"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Boot-Partition finden (FAT32 mit cmdline.txt)
if ($Drive -eq "") {
    $candidates = Get-PSDrive -PSProvider FileSystem | Where-Object {
        $_.Root -ne "" -and (Test-Path "$($_.Root)cmdline.txt")
    }
    if ($candidates.Count -eq 0) {
        Write-Error "Keine Pi-Boot-Partition gefunden. SD-Karte eingelegt und geflasht?"
        exit 1
    }
    if ($candidates.Count -gt 1) {
        Write-Host "Mehrere Kandidaten gefunden:"
        $candidates | ForEach-Object { Write-Host "  $($_.Root)" }
        Write-Error "Bitte Laufwerk explizit angeben: .\setup-sd.ps1 -Drive D:"
        exit 1
    }
    $Drive = $candidates[0].Root.TrimEnd('\')
}

$BootDrive = $Drive.TrimEnd('\')
Write-Host "Boot-Partition: $BootDrive"

# Pruefen ob es wirklich ein Pi-Boot ist
if (-not (Test-Path "$BootDrive\cmdline.txt")) {
    Write-Error "$BootDrive ist keine Pi-Boot-Partition (keine cmdline.txt)."
    exit 1
}

# firstrun.sh kopieren
$FirstrunSrc = Join-Path $ScriptDir "firstrun.sh"
if (-not (Test-Path $FirstrunSrc)) {
    Write-Error "firstrun.sh nicht gefunden: $FirstrunSrc"
    exit 1
}
Copy-Item $FirstrunSrc "$BootDrive\firstrun.sh" -Force
Write-Host "firstrun.sh kopiert."

# wlan.txt erstellen oder vorhandene befuellen
$WlanDest = "$BootDrive\wlan.txt"
if ($SSID -ne "" -and $Password -ne "") {
    # Direkt befuellen
    $wlanContent = "# BoatOS WLAN-Konfiguration`nSSID=$SSID`nPASSWORD=$Password`nCOUNTRY=$Country"
    Set-Content $WlanDest $wlanContent -Encoding utf8
    Write-Host "wlan.txt geschrieben (SSID: $SSID)."
} else {
    # Template kopieren
    $WlanSrc = Join-Path $ScriptDir "wlan.txt"
    Copy-Item $WlanSrc $WlanDest -Force
    Write-Host "wlan.txt Template kopiert - bitte jetzt editieren:"
    Start-Process notepad $WlanDest
    Write-Host ""
    Write-Host "Trage SSID und PASSWORD ein, speichere die Datei, dann SD-Karte einlegen."
    Write-Host ""
}

# cmdline.txt: systemd.run hinzufuegen
$CmdlinePath = "$BootDrive\cmdline.txt"
$cmdline = (Get-Content $CmdlinePath -Raw).TrimEnd()
if ($cmdline -notmatch "firstrun\.sh") {
    $cmdline = $cmdline + " systemd.run=/boot/firmware/firstrun.sh"
    Set-Content $CmdlinePath $cmdline -Encoding utf8 -NoNewline
    Write-Host "cmdline.txt aktualisiert (firstrun.sh eingetragen)."
} else {
    Write-Host "cmdline.txt: firstrun.sh bereits eingetragen."
}

Write-Host ""
Write-Host "Fertig! SD-Karte sicher auswerfen und in den Pi einlegen."
