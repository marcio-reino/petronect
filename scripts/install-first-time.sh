#!/bin/bash

# ================================================
# Script de Instalação Inicial - Petronect
# ================================================
# Execute apenas na PRIMEIRA instalação
# ================================================

set -e

APP_DIR="/var/www/petronect"
REPO_URL="seu_repositorio_git_aqui"

echo "========================================"
echo " Petronect - Instalação Inicial"
echo "========================================"

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo "[ERRO] Execute como root: sudo ./install-first-time.sh"
    exit 1
fi

# Atualizar sistema
echo "[INFO] Atualizando sistema..."
apt update && apt upgrade -y

# Instalar dependências do sistema
echo "[INFO] Instalando dependências..."
apt install -y curl git build-essential

# Instalar Node.js 20 LTS
echo "[INFO] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2
echo "[INFO] Instalando PM2..."
npm install -g pm2

# Instalar MySQL (se necessário)
echo "[INFO] Instalando MySQL..."
apt install -y mysql-server
systemctl enable mysql
systemctl start mysql

# Criar diretório da aplicação
echo "[INFO] Criando diretórios..."
mkdir -p $APP_DIR
mkdir -p /var/backups/petronect

# Clonar repositório
echo "[INFO] Clonando repositório..."
cd /var/www
git clone $REPO_URL petronect

# Configurar permissões
chown -R www-data:www-data $APP_DIR

# Criar banco de dados
echo "[INFO] Configurando banco de dados..."
echo "Execute os seguintes comandos no MySQL:"
echo ""
echo "  mysql -u root -p"
echo "  CREATE DATABASE petronect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  CREATE USER 'petronect'@'localhost' IDENTIFIED BY 'sua_senha_segura';"
echo "  GRANT ALL PRIVILEGES ON petronect.* TO 'petronect'@'localhost';"
echo "  FLUSH PRIVILEGES;"
echo "  EXIT;"
echo ""
echo "Depois, importe o schema:"
echo "  mysql -u root -p petronect < $APP_DIR/sql/schema.sql"
echo ""

# Configurar arquivos .env
echo "[INFO] Configure os arquivos .env:"
echo ""
echo "  Backend: $APP_DIR/backend/.env"
echo "  Frontend: $APP_DIR/frontend/.env"
echo ""
echo "Copie os arquivos .env.example e ajuste as configurações."
echo ""

# Instalar dependências do Playwright
echo "[INFO] Instalando dependências do Playwright..."
apt install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2

echo ""
echo "========================================"
echo " Instalação inicial concluída!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo "  1. Configure o banco de dados MySQL"
echo "  2. Configure os arquivos .env"
echo "  3. Execute: ./deploy.sh"
echo ""
echo "========================================"
