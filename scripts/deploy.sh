#!/bin/bash

# ================================================
# Script de Deploy - Petronect
# ================================================
# Uso: ./deploy.sh [production|staging]
# ================================================

set -e

ENVIRONMENT=${1:-production}
APP_DIR="/var/www/petronect"
BACKUP_DIR="/var/backups/petronect"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo " Petronect - Deploy Script"
echo " Ambiente: $ENVIRONMENT"
echo " Data: $(date)"
echo "========================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    log_error "Execute como root: sudo ./deploy.sh"
    exit 1
fi

# Verificar dependências
check_dependencies() {
    log_info "Verificando dependências..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js não encontrado. Instale: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "NPM não encontrado"
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 não encontrado. Instalando..."
        npm install -g pm2
    fi
    
    log_info "Node: $(node -v)"
    log_info "NPM: $(npm -v)"
    log_info "PM2: $(pm2 -v)"
}

# Criar backup
create_backup() {
    log_info "Criando backup..."
    
    mkdir -p $BACKUP_DIR
    
    if [ -d "$APP_DIR" ]; then
        tar -czf "$BACKUP_DIR/petronect_$TIMESTAMP.tar.gz" -C "$APP_DIR" . || true
        log_info "Backup criado: petronect_$TIMESTAMP.tar.gz"
    fi
}

# Atualizar código
update_code() {
    log_info "Atualizando código..."
    
    cd $APP_DIR
    
    # Pull das últimas alterações
    git fetch origin
    git reset --hard origin/main
    
    log_info "Código atualizado"
}

# Instalar dependências do Backend
install_backend() {
    log_info "Instalando dependências do Backend..."
    
    cd $APP_DIR/backend
    npm ci --production
    
    # Instalar Playwright browsers
    npx playwright install chromium
    npx playwright install-deps chromium
    
    log_info "Backend pronto"
}

# Instalar e buildar Frontend
install_frontend() {
    log_info "Instalando dependências do Frontend..."
    
    cd $APP_DIR/frontend
    npm ci
    
    log_info "Buildando Frontend..."
    npm run build
    
    log_info "Frontend pronto"
}

# Configurar PM2
configure_pm2() {
    log_info "Configurando PM2..."
    
    cd $APP_DIR
    
    # Criar arquivo de configuração PM2
    cat > ecosystem.config.js << 'PMEOF'
module.exports = {
  apps: [
    {
      name: 'petronect-backend',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'petronect-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PMEOF

    # Criar diretório de logs
    mkdir -p $APP_DIR/logs
    
    log_info "PM2 configurado"
}

# Reiniciar serviços
restart_services() {
    log_info "Reiniciando serviços..."
    
    cd $APP_DIR
    
    # Parar aplicações existentes
    pm2 delete petronect-backend 2>/dev/null || true
    pm2 delete petronect-frontend 2>/dev/null || true
    
    # Iniciar com novo config
    pm2 start ecosystem.config.js
    
    # Salvar config do PM2
    pm2 save
    
    # Garantir que PM2 inicie no boot
    pm2 startup systemd -u root --hp /root
    
    log_info "Serviços reiniciados"
}

# Verificar status
check_status() {
    log_info "Verificando status..."
    
    sleep 5
    pm2 status
    
    echo ""
    log_info "Testando endpoints..."
    
    # Testar backend
    if curl -s http://localhost:5000/api/health > /dev/null; then
        log_info "Backend: OK"
    else
        log_warn "Backend: Não respondendo"
    fi
    
    # Testar frontend
    if curl -s http://localhost:3000 > /dev/null; then
        log_info "Frontend: OK"
    else
        log_warn "Frontend: Não respondendo"
    fi
}

# Limpeza
cleanup() {
    log_info "Limpando arquivos antigos..."
    
    # Manter apenas últimos 5 backups
    cd $BACKUP_DIR
    ls -t | tail -n +6 | xargs -r rm -f
    
    # Limpar cache npm
    npm cache clean --force 2>/dev/null || true
    
    log_info "Limpeza concluída"
}

# Execução principal
main() {
    check_dependencies
    create_backup
    update_code
    install_backend
    install_frontend
    configure_pm2
    restart_services
    check_status
    cleanup
    
    echo ""
    echo "========================================"
    log_info "Deploy concluído com sucesso!"
    echo "========================================"
    echo ""
    echo "URLs:"
    echo "  Frontend: http://$(hostname -I | awk '{print $1}'):3000"
    echo "  Backend:  http://$(hostname -I | awk '{print $1}'):5000/api"
    echo ""
    echo "Comandos úteis:"
    echo "  pm2 status          - Ver status"
    echo "  pm2 logs            - Ver logs"
    echo "  pm2 restart all     - Reiniciar tudo"
    echo "========================================"
}

main
