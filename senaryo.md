# 0) Servisler ayakta mı?

echo "\n--- 0) Docker containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 1) Başlangıç health kontrolü

echo "\n--- 1) Initial health check ---"
curl -s http://localhost:4000/health/services | jq

# 2) Normal bankacılık işlemi: fraud-check ayaktayken approved dönmeli

echo "\n--- 2) Normal demo transaction ---"
curl -s -X POST http://localhost:4000/banking/demo-transaction | jq

# 3) Chaos başlat: fraud-check-service'i durdur

echo "\n--- 3) Kill fraud-check-service ---"
KILL_RESPONSE=$(curl -s -X POST http://localhost:4000/experiments/kill-fraud-check)
echo "$KILL_RESPONSE" | jq

# Experiment ID'yi al

EXPERIMENT_ID=$(echo "$KILL_RESPONSE" | jq -r '.id')
echo "\nExperiment ID: $EXPERIMENT_ID"

# 4) Chaos sonrası health kontrolü

echo "\n--- 4) Health check after chaos ---"
curl -s http://localhost:4000/health/services | jq

# 5) Fraud servisi kapalıyken transaction dene

# Beklenen: pending_manual_review / degraded true

echo "\n--- 5) Demo transaction while fraud-check-service is DOWN ---"
curl -s -X POST http://localhost:4000/banking/demo-transaction | jq

# 6) Deney detayını gör

echo "\n--- 6) Experiment detail before recovery ---"
curl -s http://localhost:4000/experiments/$EXPERIMENT_ID | jq

# 7) Sistemi recover et

echo "\n--- 7) Recover fraud-check-service ---"
curl -s -X POST http://localhost:4000/experiments/recover-fraud-check | jq

# 8) Recovery sonrası health kontrolü

echo "\n--- 8) Health check after recovery ---"
curl -s http://localhost:4000/health/services | jq

# 9) Recovery sonrası tekrar normal transaction

echo "\n--- 9) Demo transaction after recovery ---"
curl -s -X POST http://localhost:4000/banking/demo-transaction | jq

# 10) Deneyleri listele

echo "\n--- 10) All experiments ---"
curl -s http://localhost:4000/experiments | jq

# 11) Gemini / fallback Golden Trace analizi üret

echo "\n--- 11) Analyze experiment and create Golden Trace ---"
curl -s -X POST http://localhost:4000/experiments/$EXPERIMENT_ID/analyze | jq

# 12) Golden Trace kayıtlarını listele

echo "\n--- 12) Golden traces ---"
curl -s http://localhost:4000/golden-traces | jq

# 13) Backend loglarında Gemini/fallback kontrolü

echo "\n--- 13) Last API logs ---"
docker compose logs --tail=80 kintsugi-monkey-api

## YUKARIDAKİ KOMUTLARI TEK TEK YAZARAK SENARYOYU CALISTIRIN

BEKLENEN SONUÇ:

Başta:
fraud-check-service = UP
transaction-service = UP
transaction status = approved

Chaos sonrası:
fraud-check-service = DOWN
transaction-service = DEGRADED
transaction status = pending_manual_review

Recovery sonrası:
fraud-check-service = UP
transaction-service = UP

Analyze sonrası:
Golden Trace oluşur.
analyzer alanı gemini veya fallback olur.

EĞER jq bulunmuyorsa mac için jq kurulumu:
brew install jq
