# encode_mqtt.ps1 — XOR-encode MQTT credentials for svc.json
# Usage: .\encode_mqtt.ps1 -User "youruser" -Pass "yourpass"
# Key must match MQTT_XOR_KEY in config.h

param(
    [Parameter(Mandatory)][string]$User,
    [Parameter(Mandatory)][string]$Pass
)

$key = @(0x4F, 0x7C, 0x2A, 0x91, 0xB3, 0x5E, 0xD8, 0x16, 0xFA, 0x33, 0x6B, 0xC4, 0x8D, 0x29, 0x74, 0xE0)

function Encode-Str($s) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
    $hex = ""
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $hex += "{0:x2}" -f ($bytes[$i] -bxor $key[$i % $key.Length])
    }
    return $hex
}

Write-Host ""
Write-Host "Encoded user: $(Encode-Str $User)"
Write-Host "Encoded pass: $(Encode-Str $Pass)"
Write-Host ""
Write-Host "Replace the target entry in assets/svc.json, then commit and push."
