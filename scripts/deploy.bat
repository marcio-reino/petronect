@echo off
REM ================================================
REM Script de Deploy - Petronect (Windows)
REM ================================================
REM Uso: deploy.bat
REM ================================================

setlocal enabledelayedexpansion

echo ========================================
echo  Petronect - Deploy Script (Windows)
echo  Data: %date% %time%
echo ========================================

set APP_DIR=%~dp0..
cd /d %APP_DIR%

REM Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js nao encontrado. Instale em: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node: 
node -v

REM Verificar PM2
where pm2 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Instalando PM2...
    call npm install -g pm2
)

echo.
echo [INFO] Instalando dependencias do Backend...
cd backend
call npm ci --production

echo.
echo [INFO] Instalando Playwright...
call npx playwright install chromium

echo.
echo [INFO] Instalando dependencias do Frontend...
cd ..\frontend
call npm ci

echo.
echo [INFO] Buildando Frontend...
call npm run build

echo.
echo [INFO] Criando configuracao PM2...
cd ..

(
echo module.exports = {
echo   apps: [
echo     {
echo       name: 'petronect-backend',
echo       cwd: './backend',
echo       script: 'src/server.js',
echo       instances: 1,
echo       autorestart: true,
echo       watch: false,
echo       max_memory_restart: '1G',
echo       env: {
echo         NODE_ENV: 'production',
echo         PORT: 5000
echo       }
echo     },
echo     {
echo       name: 'petronect-frontend',
echo       cwd: './frontend',
echo       script: 'node_modules/next/dist/bin/next',
echo       args: 'start -p 3000',
echo       instances: 1,
echo       autorestart: true,
echo       watch: false,
echo       max_memory_restart: '1G',
echo       env: {
echo         NODE_ENV: 'production',
echo         PORT: 3000
echo       }
echo     }
echo   ]
echo };
) > ecosystem.config.js

echo.
echo [INFO] Iniciando servicos...
call pm2 delete petronect-backend 2>nul
call pm2 delete petronect-frontend 2>nul
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo ========================================
echo  Deploy concluido!
echo ========================================
echo.
echo URLs:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000/api
echo.
echo Comandos uteis:
echo   pm2 status          - Ver status
echo   pm2 logs            - Ver logs
echo   pm2 restart all     - Reiniciar tudo
echo ========================================

pause
