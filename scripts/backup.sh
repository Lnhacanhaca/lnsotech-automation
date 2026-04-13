#!/bin/bash
# LNSOTECH Backup Script — Correr na VPS manualmente ou via cron
# Uso: bash scripts/backup.sh

BACKUP_DIR="/opt/apps/bot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup da base de dados..."

# 1. Backup PostgreSQL
docker exec lnsotech-db-bot-v2 pg_dump -U lnso_admin lnsotech_db > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

if [ $? -eq 0 ]; then
    echo "✅ Backup SQL criado: $BACKUP_DIR/db_backup_$TIMESTAMP.sql"
    
    # 2. Comprimir
    gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
    echo "📦 Comprimido: db_backup_$TIMESTAMP.sql.gz"
else
    echo "❌ Erro no backup!"
    exit 1
fi

# 3. Backup das sessões Baileys
cp -r /opt/apps/bot/lnsotech-automation/auth_info_baileys "$BACKUP_DIR/auth_backup_$TIMESTAMP" 2>/dev/null
echo "📱 Sessão WhatsApp copiada"

# 4. Limpeza: manter apenas os últimos 10 backups
ls -t $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm
ls -dt $BACKUP_DIR/auth_backup_* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "🎉 Backup completo! Ficheiros em: $BACKUP_DIR"
ls -lh $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz
