const isClient = typeof window !== 'undefined';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

    // Product Management
    fetchAllProducts: async (status?: string) => {
        const url = status ? `${API_URL}/products/all?status=${status}` : `${API_URL}/products/all`;
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
    }
};
