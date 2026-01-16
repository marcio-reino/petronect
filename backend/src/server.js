const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const routes = require('./routes');
const { cleanupHistoricoInterno } = require('./controllers/roboController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares - CORS manual para garantir funcionamento
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging de requisições em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Rotas
app.use('/api', routes);

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bem-vindo à API do Agente Petronect',
    version: '1.0.0'
  });
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Iniciar servidor
const startServer = async () => {
  try {
    // Testar conexão com o banco de dados
    await testConnection();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}\n`);

      // Scheduler de limpeza de histórico (executa a cada 6 horas)
      const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas em ms
      const HISTORICO_LIMITE = parseInt(process.env.HISTORICO_LIMITE) || 500;

      setInterval(async () => {
        console.log('[Scheduler] Executando limpeza de histórico...');
        await cleanupHistoricoInterno(HISTORICO_LIMITE);
      }, CLEANUP_INTERVAL);

      // Executar limpeza inicial após 1 minuto do servidor iniciar
      setTimeout(async () => {
        console.log('[Scheduler] Executando limpeza inicial de histórico...');
        await cleanupHistoricoInterno(HISTORICO_LIMITE);
      }, 60000);
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
