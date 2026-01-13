const mysql = require('mysql2');
require('dotenv').config();

// Configuração do pool de conexões
let poolConfig;

// Se estiver em produção e tiver DATABASE_URL, usa a URL de conexão
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // Formato: mysql://user:password@host:port/database
  poolConfig = {
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  console.log('🔗 Usando DATABASE_URL para conexão em produção');
} else {
  // Caso contrário, usa as variáveis individuais (desenvolvimento)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_treinamentos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

// Criar pool de conexões
const pool = mysql.createPool(poolConfig);

// Promisify para usar async/await
const promisePool = pool.promise();

// Testar conexão
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Conexão com MySQL estabelecida com sucesso!');
    connection.release();
  } catch (error) {
    console.error('❌ Erro ao conectar com MySQL:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, promisePool, testConnection };
