const API_URL = '/api';
const isClient = typeof window !== 'undefined';

const storage = {
    get: (key: string) => {
        if (!isClient) return null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
};

const safeJson = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await response.json();
    }
    // For non-JSON responses (plain text errors), wrap in message object
    const text = await response.text().catch(() => '');
    if (text) return { message: text };
    return null;
};

const getHeaders = () => {
    const token = storage.get('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const adminService = {
    // User Management
    fetchAllUsers: async () => {
        const response = await fetch(`${API_URL}/users/all`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch users');
        return result;
    },

    fetchUserDetails: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch user details');
        return result;
    },

    updateUserStatus: async (userId: string, status: string) => {
        const response = await fetch(`${API_URL}/users/${userId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update user status');
        return result;
    },

    fetchDeactivatedUsers: async () => {
        const response = await fetch(`${API_URL}/users/deactivated`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch deactivated users');
        return result;
    },

    softDeleteUser: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to mark user for deletion');
        return result;
    },

    permanentlyDeleteUser: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}/permanent`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to permanently delete user');
        return result;
    },

    restoreUser: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}/restore`, {
            method: 'POST',
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to restore user');
        return result;
    },

    // Product Management
    fetchAllProducts: async (status?: string, userId?: string) => {
        let url = `${API_URL}/products/all`;
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (userId) params.append('userId', userId);
        
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        
        const response = await fetch(url, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch products');
        return result;
    },

    fetchProductDetails: async (id: string) => {
        const response = await fetch(`${API_URL}/products/${id}`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch product details');
        return result;
    },

    updateProductStatus: async (productId: string, status: string) => {
        const response = await fetch(`${API_URL}/products/${productId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update product status');
        return result;
    },

    deleteProduct: async (id: string) => {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete product');
        return result;
    },

    // Ads Management
    fetchAllAds: async (status?: string) => {
        let url = `${API_URL}/ads/all`;
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await fetch(url, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch ads');
        return result;
    },

    updateAdStatus: async (adId: string, status: string, options?: { rejectionReason?: string; rejectionNote?: string }) => {
        const response = await fetch(`${API_URL}/ads/${adId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status, ...(options || {}) }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update ad status');
        return result;
    },

    // Order Management
    fetchAllOrders: async (status?: string) => {
        let url = `${API_URL}/order/all`;
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await fetch(url, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch orders');
        return result?.data || result;
    },

    updateAdminOrderStatus: async (orderId: string | number, status: string) => {
        const response = await fetch(`${API_URL}/order/${orderId}/admin-status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update order status');
        return result?.data || result;
    },

    // Post Management
    addTestLink: async (link: string) => {
        const response = await fetch(`${API_URL}/posts/test-link`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ link }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to add test link');
        return result;
    },

    // Global Stats
    fetchStats: async () => {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch stats');
        return result;
    },

    fetchRecentActivity: async () => {
        const response = await fetch(`${API_URL}/admin/recent-activity`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch activity');
        return result || [];
    },

    transferGoogerToAdmin: async (adminId: number, amount: number) => {
        const response = await fetch(`${API_URL}/admin/transfer-googer-to-admin`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ adminId, amount })
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to transfer to admin');
        return result;
    },

    fetchUserTransactions: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}/transactions`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch transactions');
        return result;
    }
};
