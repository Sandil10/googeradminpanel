const API_URL = '/api';

const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const safeJson = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    const text = await response.text().catch(() => '');
    return text ? { message: text } : null;
};

export const adService = {
    collectCoin: async (adId: string) => {
        const response = await fetch(`${API_URL}/ads/${encodeURIComponent(adId)}/collect-coin`, {
            method: 'POST',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to collect coin');
        return result;
    },

    likeCoin: async (adId: string) => {
        const response = await fetch(`${API_URL}/ads/${encodeURIComponent(adId)}/like`, {
            method: 'POST',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to like ad');
        return result;
    },
};
