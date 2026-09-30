const { Pool, types } = require('pg');
const { parseIntoClientConfig } = require('pg-connection-string');
const fs = require('fs');
require('dotenv').config();

// Return timestamps as raw UTC strings so we handle timezone conversion
// in the frontend ourselves. Without this, pg uses the local Node.js
// timezone when constructing Date objects, which causes a double-offset
// when the server runs in Asia/Colombo and the DB stores times in UTC.
types.setTypeParser(1114, (val) => val); // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ

const dbConfig = {};

const isFalseLike = (value) => ['false', '0', 'no'].includes(String(value || '').toLowerCase());
const isTrueLike = (value) => ['true', 'require', 'required', '1', 'yes'].includes(String(value || '').toLowerCase());

function applySslOverrides(config) {
    const wantsSsl = isTrueLike(process.env.DB_SSL) || typeof config.ssl !== 'undefined';

    if (!wantsSsl) {
        return;
    }

    if (config.ssl === true || typeof config.ssl !== 'object') {
        config.ssl = {};
    }

    if (process.env.DB_SSL_REJECT_UNAUTHORIZED) {
        config.ssl.rejectUnauthorized = !isFalseLike(process.env.DB_SSL_REJECT_UNAUTHORIZED);
    }
}

// LOGIC: Priority is given to EXPLICIT LOCAL CONFIG (DB_HOST) if present.
// This allows developers to use a local DB by setting DB_HOST in .env,
// while Vercel automatically uses DATABASE_URL/POSTGRES_URL for Supabase.

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (connectionString) {
    console.log('Using Hosted/Cloud Database Connection');
    Object.assign(dbConfig, parseIntoClientConfig(connectionString));
    applySslOverrides(dbConfig);
} else if (process.env.DB_HOST) {
    console.log(`Using Local Database Config: ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`);
    dbConfig.host = process.env.DB_HOST;
    dbConfig.port = process.env.DB_PORT || 5432;
    dbConfig.database = process.env.DB_NAME;
    dbConfig.user = process.env.DB_USER;
    dbConfig.password = process.env.DB_PASSWORD;

    const sslMode = String(process.env.DB_SSL || '').toLowerCase();
    const shouldUseSsl = isTrueLike(sslMode)
        || /\.rds\.amazonaws\.com$/i.test(process.env.DB_HOST || '');

    if (shouldUseSsl) {
        dbConfig.ssl = {};
        applySslOverrides(dbConfig);
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL: No Database Connection Configuration Found!');
    } else {
        console.warn('Warning: No Database Configuration Found in .env (Add DATABASE_URL for Supabase)');
    }
}

if (dbConfig.ssl && process.env.DB_SSL_CA_FILE) {
    dbConfig.ssl.ca = fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8');
}

const poolMax = Number.parseInt(String(process.env.DB_POOL_MAX || process.env.PGPOOL_MAX || '15'), 10);
const poolIdleTimeoutMs = Number.parseInt(String(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000'), 10);
const poolConnectionTimeoutMs = Number.parseInt(String(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '10000'), 10);
const poolMaxUses = Number.parseInt(String(process.env.DB_POOL_MAX_USES || '5000'), 10);

dbConfig.max = Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 15;
dbConfig.idleTimeoutMillis = Number.isFinite(poolIdleTimeoutMs) && poolIdleTimeoutMs > 0 ? poolIdleTimeoutMs : 30000;
dbConfig.connectionTimeoutMillis = Number.isFinite(poolConnectionTimeoutMs) && poolConnectionTimeoutMs > 0 ? poolConnectionTimeoutMs : 10000;
dbConfig.maxUses = Number.isFinite(poolMaxUses) && poolMaxUses > 0 ? poolMaxUses : 5000;

const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    const code = err?.code || 'UNKNOWN';

    if (code === '57P01' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
        console.warn('PostgreSQL idle connection was closed. The pool will reconnect on the next query.', err?.message || err);
        return;
    }

    console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
