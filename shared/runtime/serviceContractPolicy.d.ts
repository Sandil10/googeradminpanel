export function assertRemoteServiceConfigured(options?: {
    envVar?: string;
    serviceName?: string;
    reason?: string;
}): string;

export function createMissingContractError(options?: {
    envVar?: string;
    serviceName?: string;
    reason?: string;
}): Error & {
    statusCode?: number;
    code?: string;
    serviceName?: string;
    envVar?: string;
};

export function getRemoteServiceUrl(envVar: string): string;
export function isStrictRouteOwnershipModeEnabled(): boolean;
export function isStrictServiceContractModeEnabled(): boolean;
export function normalizeUrl(value?: string): string;

export function resolveRemoteServiceUrl(options?: {
    envVar?: string;
    fallbackUrl?: string;
    serviceName?: string;
    reason?: string;
}): string;

export function shouldUseRemoteService(options?: {
    envVar?: string;
    serviceName?: string;
    reason?: string;
}): {
    enabled: boolean;
    url: string;
};
