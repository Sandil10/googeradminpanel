const normalizeFlag = (value) => String(value || '').trim().toLowerCase();

const isEnabled = (value) => ['1', 'true', 'yes', 'on', 'strict', 'remote'].includes(normalizeFlag(value));

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const getRemoteServiceUrl = (envVar) => normalizeUrl(process.env[envVar]);

const createMissingContractError = ({ envVar, serviceName, reason = 'remote contract required' } = {}) => {
    const error = new Error(`${serviceName} requires an explicit remote service contract (${envVar}) for ${reason}`);
    error.statusCode = 503;
    error.code = 'REMOTE_SERVICE_CONTRACT_REQUIRED';
    error.serviceName = serviceName;
    error.envVar = envVar;
    return error;
};

const isStrictServiceContractModeEnabled = () => (
    isEnabled(process.env.STRICT_SERVICE_CONTRACTS)
    || normalizeFlag(process.env.SERVICE_CONTRACT_MODE) === 'strict'
);

const isStrictRouteOwnershipModeEnabled = () => (
    isEnabled(process.env.STRICT_ROUTE_SERVICE_OWNERSHIP)
    || normalizeFlag(process.env.SERVICE_ROUTE_OWNERSHIP_MODE) === 'strict'
);

const assertRemoteServiceConfigured = ({ envVar, serviceName, reason } = {}) => {
    const url = getRemoteServiceUrl(envVar);
    if (url) return url;
    throw createMissingContractError({ envVar, serviceName, reason });
};

const shouldUseRemoteService = ({ envVar, serviceName, reason } = {}) => {
    const url = getRemoteServiceUrl(envVar);
    if (url) {
        return {
            enabled: true,
            url,
        };
    }

    if (isStrictServiceContractModeEnabled()) {
        throw createMissingContractError({ envVar, serviceName, reason });
    }

    return {
        enabled: false,
        url: '',
    };
};

const resolveRemoteServiceUrl = ({
    envVar,
    fallbackUrl = '',
    serviceName,
    reason,
} = {}) => {
    const configuredUrl = getRemoteServiceUrl(envVar);
    if (configuredUrl) return configuredUrl;

    if (isStrictServiceContractModeEnabled()) {
        throw createMissingContractError({ envVar, serviceName, reason });
    }

    return normalizeUrl(fallbackUrl);
};

module.exports = {
    assertRemoteServiceConfigured,
    createMissingContractError,
    getRemoteServiceUrl,
    isStrictRouteOwnershipModeEnabled,
    isStrictServiceContractModeEnabled,
    normalizeUrl,
    resolveRemoteServiceUrl,
    shouldUseRemoteService,
};
