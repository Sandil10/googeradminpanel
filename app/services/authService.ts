const isClient = typeof window !== 'undefined';
// Uses Next.js rewrites to proxy /api/* -> http://localhost:5000/api/*
const API_URL = '/api';

// Safe storage wrapper for Safari/iPhone compatibility
const storage = {
    get: (key: string) => {
        if (!isClient) return null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: (key: string, value: string) => {
        if (!isClient) return;
        try { localStorage.setItem(key, value); } catch (e) { console.warn('Storage blocked'); }
    },
    remove: (key: string) => {
        if (!isClient) return;
        try { localStorage.removeItem(key); } catch (e) { }
    }
};

// Helper to safely parse JSON from a response
const safeJson = async (response: Response) => {
    try {
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

export const authService = {
    login: async (data: any) => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).catch(() => {
                throw new Error('Server connection failed. Is the backend running?');
            });

            const result = await safeJson(response);

            if (!response.ok) {
                throw new Error(result?.message || `Error: ${response.status} ${response.statusText}`);
            }

            if (result?.token) {
                storage.set('token', result.token);
                storage.set('user', JSON.stringify(result.user));
            }
            return result;
        } catch (error: any) {
            console.error('Login error detail:', error);
            throw error;
        }
    },

    register: async (data: any) => {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).catch(() => {
                throw new Error('Server connection failed.');
            });

            const result = await safeJson(response);

            if (!response.ok) {
                throw new Error(result?.message || `Error: ${response.status}`);
            }

            if (result?.token) {
                storage.set('token', result.token);
                storage.set('user', JSON.stringify(result.user));
            }
            return result;
        } catch (error: any) {
            throw error;
        }
    },

    isAuthenticated: () => !!storage.get('token'),

    getProfile: async () => {
        try {
            const token = storage.get('token');
            if (!token) throw new Error('No session found');

            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await safeJson(response);
            if (!response.ok) {
                const errorMsg = result?.message || result?.error || `Error: ${response.status}`;
                throw new Error(errorMsg);
            }

            if (result && result.user) {
                // Merge with existing stored user to preserve user_type if backend omits it
                const existing = (() => { try { return JSON.parse(storage.get('user') || '{}'); } catch { return {}; } })();
                const merged = { ...existing, ...result.user };
                storage.set('user', JSON.stringify(merged));
                return merged;
            }
            return result;
        } catch (error: any) {
            throw error;
        }
    },

    getWallet: async () => {
        try {
            const token = storage.get('token');
            if (!token) throw new Error('No session found');

            const response = await fetch(`${API_URL}/auth/wallet`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to fetch wallet');
            return result;
        } catch (error: any) {
            throw error;
        }
    },

    verifyPassword: async (password: string) => {
        try {
            const token = storage.get('token');
            if (!token) throw new Error('No session found');

            const response = await fetch(`${API_URL}/auth/verify-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Verification failed');
            return result;
        } catch (error: any) {
            throw error;
        }
    },

    updateProfile: async (data: any) => {
        try {
            const token = storage.get('token');
            if (!token) throw new Error('No session found');

            const isFormData = data instanceof FormData;

            const response = await fetch(`${API_URL}/auth/update-profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                },
                body: isFormData ? data : JSON.stringify(data),
            });

            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to update profile');

            if (result?.user) storage.set('user', JSON.stringify(result.user));
            return result;
        } catch (error: any) {
            throw error;
        }
    },

    logout: () => {
        storage.remove('token');
        storage.remove('user');
        if (isClient) window.location.href = '/';
    }
};
