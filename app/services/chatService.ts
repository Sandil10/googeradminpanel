const API_URL = '/api';
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

const request = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
            ...getHeaders(),
            ...(options.headers || {}),
        },
    });

    const result = await safeJson(response);

    if (!response.ok) {
        throw new Error(result?.message || 'Chat request failed');
    }

    return result?.data;
};

export const chatService = {
    updatePresence: async (activeParticipantId?: number | null) =>
        request('/chat/presence', {
            method: 'POST',
            body: JSON.stringify({ activeParticipantId: activeParticipantId ?? null }),
        }),

    getMessages: async (participantId: number, markSeen: boolean = false) =>
        request(`/chat/messages/${participantId}?markSeen=${markSeen ? '1' : '0'}`),

    sendMessage: async (payload: {
        receiverId: number;
        type: 'text' | 'image';
        text?: string;
        image_url?: string;
        file_name?: string;
    }) =>
        request('/chat/messages', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};
