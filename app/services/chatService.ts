const API_URL = '/api';
const MAIN_API_URL = '/googer-api';
const isClient = typeof window !== 'undefined';

const storage = {
    get: (key: string) => {
        if (!isClient) return null;
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }
};

const safeJson = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }

    const text = await response.text().catch(() => '');
    return text ? { message: text } : null;
};

const getHeaders = () => {
    const token = storage.get('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (response: Response, attempt: number) => {
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return retryAfter * 1000;
    }
    return 600 * attempt;
};

const request = async (url: string, options: RequestInit = {}) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await fetch(`${API_URL}${url}`, {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options.headers || {}),
            },
        });

        const result = await safeJson(response);

        if (response.ok) {
            return result?.data;
        }

        if (response.status === 429 && attempt < 3) {
            await sleep(getRetryDelayMs(response, attempt));
            continue;
        }

        throw new Error(result?.message || 'Chat request failed');
    }
    throw new Error('Chat request failed');
};

const requestMain = async (url: string, options: RequestInit = {}) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await fetch(`${MAIN_API_URL}${url}`, {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options.headers || {}),
            },
        });

        const result = await safeJson(response);

        if (response.ok) {
            return result?.data;
        }

        if (response.status === 429 && attempt < 3) {
            await sleep(getRetryDelayMs(response, attempt));
            continue;
        }

        throw new Error(result?.message || 'Chat request failed');
    }
    throw new Error('Chat request failed');
};

export const chatService = {
    updatePresence: async (
        activeParticipantId?: number | null,
        activeProductStatusId?: string | null,
        activeTopupRequestId?: number | null
    ) =>
        requestMain('/chat/presence', {
            method: 'POST',
            body: JSON.stringify({
                activeParticipantId: activeParticipantId ?? null,
                activeProductStatusId: activeProductStatusId ?? null,
                activeTopupRequestId: activeTopupRequestId ?? null,
            }),
        }),

    getMessages: async (
        participantId: number,
        markSeen: boolean = false,
        productStatusId?: string | null,
        topupRequestId?: number | null,
        assignedAdminId?: number | null
    ) =>
        requestMain(`/chat/messages/${participantId}?markSeen=${markSeen ? '1' : '0'}${productStatusId ? `&productStatusId=${encodeURIComponent(productStatusId)}` : ''}${topupRequestId ? `&topupRequestId=${topupRequestId}` : ''}${assignedAdminId ? `&assignedAdminId=${assignedAdminId}` : ''}`),

    sendMessage: async (payload: {
        receiverId: number;
        type: 'text' | 'image';
        text?: string;
        image_url?: string;
        file_name?: string;
        productStatusId?: string;
        topupRequestId?: number;
        assignedAdminId?: number;
    }) =>
        requestMain('/chat/messages', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getProductStatusAssignment: async (productStatusId: string) =>
        requestMain(`/chat/product-status/${encodeURIComponent(productStatusId)}/assignment`),

    assignProductStatusAdmin: async (productStatusId: string, assignedAdminId?: number | null) =>
        requestMain(`/chat/product-status/${encodeURIComponent(productStatusId)}/assignment`, {
            method: 'PUT',
            body: JSON.stringify({ assignedAdminId: assignedAdminId ?? null }),
        }),

    listAssignedProductStatusChats: async (assignedAdminId?: number | null) =>
        requestMain(`/chat/product-status/assignments${assignedAdminId ? `?assignedAdminId=${assignedAdminId}` : ''}`),

    getTopupRequestAssignment: async (topupRequestId: number) =>
        requestMain(`/chat/topup-request/${topupRequestId}/assignment`),

    assignTopupRequestAdmin: async (topupRequestId: number, assignedAdminId?: number | null) =>
        requestMain(`/chat/topup-request/${topupRequestId}/assignment`, {
            method: 'PUT',
            body: JSON.stringify({ assignedAdminId: assignedAdminId ?? null }),
        }),

    listAssignedTopupRequestChats: async (assignedAdminId?: number | null) =>
        requestMain(`/chat/topup-request/assignments${assignedAdminId ? `?assignedAdminId=${assignedAdminId}` : ''}`),
};
