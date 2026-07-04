const fs = require('fs');
const path = require('path');

function readEnvFile(filePath) {
    const values = {};
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index === -1) return;
        values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    });
    return values;
}

function fail(message) {
    console.error(`[runtime-contracts][fail] ${message}`);
    process.exit(1);
}

function requireKey(env, key) {
    if (!env[key]) fail(`missing required key: ${key}`);
}

function requireUrl(env, key) {
    requireKey(env, key);
    try {
        const url = new URL(env[key]);
        if (!/^https?:$/.test(url.protocol)) {
            fail(`invalid URL protocol for ${key}: ${env[key]}`);
        }
    } catch {
        fail(`invalid URL for ${key}: ${env[key]}`);
    }
}

function requireDatabaseContract(env) {
    if (env.DATABASE_URL) return;
    ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].forEach((key) => requireKey(env, key));
}

const envFile = path.resolve(process.cwd(), process.argv[2] || '.env.runtime');
if (!fs.existsSync(envFile)) {
    fail(`env file not found: ${envFile}`);
}

const env = readEnvFile(envFile);
['WEB_URL', 'ADMIN_URL', 'BACKEND_URL', 'GOOGER_MAIN_API_URL'].forEach((key) => requireUrl(env, key));
['JWT_SECRET', 'INTERNAL_SERVICE_TOKEN', 'OPS_MONITOR_TOKEN'].forEach((key) => requireKey(env, key));
requireDatabaseContract(env);

if ((env.JWT_SECRET || '').includes('replace-with-a-long-random-secret')) {
    fail('replace placeholder JWT secret before deployment');
}
if ((env.INTERNAL_SERVICE_TOKEN || '').includes('replace-with-a-long-random-internal-token')) {
    fail('replace placeholder internal token before deployment');
}
if ((env.OPS_MONITOR_TOKEN || '').includes('replace-with-a-long-random-ops-token')) {
    fail('replace placeholder ops token before deployment');
}

console.log(`[runtime-contracts][ok] ${envFile} passed validation`);
