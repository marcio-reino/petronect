# Petronect - Sistema de Monitoramento de Agentes

Sistema para gerenciamento e monitoramento de robôs/agentes automatizados para coleta de oportunidades no portal Petronect.

## Arquitetura

```
petronect/
├── backend/          # API Node.js + Express
│   ├── bots/         # Bot Playwright
│   └── src/          # Código fonte da API
├── frontend/         # Next.js + React + Tailwind
├── scripts/          # Scripts de deploy
└── sql/              # Scripts do banco de dados
```

## Requisitos

- **Node.js** 20.x LTS
- **MySQL** 8.x
- **PM2** (gerenciador de processos)
- **Playwright** (automação de browser)

---

## Instalação em Desenvolvimento

### 1. Clonar repositório

```bash
git clone <url-do-repositorio> petronect
cd petronect
```

### 2. Configurar Backend

```bash
cd backend

# Copiar arquivo de configuração
cp .env.example .env

# Editar configurações (DB, JWT, etc)
nano .env

# Instalar dependências
npm install

# Instalar Playwright
npx playwright install chromium
```

### 3. Configurar Frontend

```bash
cd frontend

# Copiar arquivo de configuração
cp .env.example .env

# Editar URL da API
nano .env

# Instalar dependências
npm install
```

### 4. Configurar Banco de Dados

```sql
-- Acessar MySQL
mysql -u root -p

-- Criar banco
CREATE DATABASE petronect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário
CREATE USER 'petronect'@'localhost' IDENTIFIED BY 'sua_senha';
GRANT ALL PRIVILEGES ON petronect.* TO 'petronect'@'localhost';
FLUSH PRIVILEGES;

-- Importar schema
EXIT;
mysql -u root -p petronect < sql/schema.sql
```

### 5. Executar em Desenvolvimento

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000/api

---

## Instalação em Produção (Linux)

### Primeira Instalação

```bash
# Baixar script de instalação
wget https://raw.githubusercontent.com/seu-repo/petronect/main/scripts/install-first-time.sh

# Executar como root
sudo chmod +x install-first-time.sh
sudo ./install-first-time.sh
```

### Deploy

```bash
cd /var/www/petronect/scripts
sudo ./deploy.sh
```

---

## Instalação em Produção (Windows)

### 1. Instalar Pré-requisitos

- [Node.js 20 LTS](https://nodejs.org/)
- [MySQL 8](https://dev.mysql.com/downloads/installer/)
- [Git](https://git-scm.com/download/win)

### 2. Instalar PM2

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

### 3. Clonar e Configurar

```powershell
cd C:\Apps
git clone <url-do-repositorio> petronect
cd petronect

# Configurar .env files
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env

# Editar arquivos .env com suas configurações
```

### 4. Executar Deploy

```powershell
cd scripts
.\deploy.bat
```

---

## Variáveis de Ambiente

### Backend (.env)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `PORT` | Porta do servidor | `5000` |
| `NODE_ENV` | Ambiente | `production` |
| `DB_HOST` | Host do MySQL | `localhost` |
| `DB_USER` | Usuário do MySQL | `petronect` |
| `DB_PASSWORD` | Senha do MySQL | `sua_senha` |
| `DB_NAME` | Nome do banco | `petronect` |
| `JWT_SECRET` | Chave secreta JWT | `min_32_chars` |
| `JWT_REFRESH_SECRET` | Chave refresh JWT | `min_32_chars` |
| `BOT_HEADLESS` | Rodar bot sem UI | `true` |

### Frontend (.env)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL da API | `http://localhost:5000/api` |

---

## Comandos PM2 Úteis

```bash
# Ver status dos processos
pm2 status

# Ver logs em tempo real
pm2 logs

# Reiniciar todos os processos
pm2 restart all

# Reiniciar processo específico
pm2 restart petronect-backend
pm2 restart petronect-frontend

# Parar todos
pm2 stop all

# Monitoramento
pm2 monit
```

---

## Estrutura do Bot

O bot Playwright (`backend/bots/bot-runner.js`) executa as seguintes tarefas:

1. Login no portal Petronect
2. Verificação de código por email (se solicitado)
3. Pesquisa de oportunidades por data ou OP específica
4. Download de PDFs e dados das oportunidades
5. Salvamento de arquivos locais

### Configurações do Bot

| Parâmetro | Descrição |
|-----------|-----------|
| `--roboId` | ID do robô no banco |
| `--login` | Usuário Petronect |
| `--senha` | Senha Petronect |
| `--data` | Dias para pesquisa |
| `--ordem` | Ordenação (0=crescente, 1=decrescente) |
| `--opresgate` | OP específica para resgatar |

---

## Nginx (Opcional - Proxy Reverso)

```nginx
server {
    listen 80;
    server_name petronect.seudominio.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### Bot não inicia

```bash
# Verificar dependências do Playwright
npx playwright install-deps chromium

# Testar manualmente
cd backend/bots
node bot-runner.js --roboId 1 --login USER --senha PASS --data 1 --bottag TEST --ordem 0
```

### Erro de conexão MySQL

```bash
# Verificar status
sudo systemctl status mysql

# Testar conexão
mysql -u petronect -p -h localhost petronect
```

### Frontend não carrega

```bash
# Verificar build
cd frontend
npm run build

# Verificar logs
pm2 logs petronect-frontend
```

---

## Suporte

Para reportar bugs ou solicitar funcionalidades, abra uma issue no repositório.
