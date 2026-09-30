const API_URL = '/api';
const MAIN_API_URL = '/googer-api';
const isClient = typeof window !== 'undefined';

const storage = {
    get: (key: string) => {
        if (!isClient) return null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
};

const safeJson = async (response: Response) => {
    const text = await response.text().catch(() => '');
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
};

const getHeaders = () => {
    const token = storage.get('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const inflightFinanceMutations = new Map<string, Promise<any>>();

const stableStringify = (value: any): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const nextFinanceMutationId = (scope: string) => {
    const uuid = typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${scope}:${uuid}`;
};

const runFinanceMutation = <T>(scope: string, payload: Record<string, any>, request: (idempotencyKey: string) => Promise<T>): Promise<T> => {
    const inflightKey = `${scope}:${stableStringify(payload)}`;
    const existing = inflightFinanceMutations.get(inflightKey);
    if (existing) return existing as Promise<T>;

    const idempotencyKey = nextFinanceMutationId(scope);
    const pending = request(idempotencyKey).finally(() => {
        inflightFinanceMutations.delete(inflightKey);
    });

    inflightFinanceMutations.set(inflightKey, pending);
    return pending;
};

export const adminService = {
    // User Management
    fetchAllUsers: async () => {
        const response = await fetch(`${API_URL}/users/all`, {
            headers: getHeaders(),
            cache: 'no-store',
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

    fetchDeletedUsers: async () => {
        const response = await fetch(`${API_URL}/users/deleted`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch deleted users');
        return result;
    },

    createUser: async (data: {
        user_id: string;
        user_type: string;
        username: string;
        full_name: string;
        email: string;
        password: string;
        confirm_password: string;
    }) => {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create user');
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

    updateAdStatus: async (adId: string, status: string, options?: { rejectionReason?: string; rejectionNote?: string; durationDays?: number }) => {
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
    fetchAdminPosts: async (search?: string) => {
        let url = `${API_URL}/posts/admin-feed`;
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await fetch(url, {
            headers: getHeaders(),
            // Live table — never serve a cached list.
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch posts');
        return result || [];
    },

    fetchGoogPostComments: async (postId: number) => {
        const response = await fetch(`${MAIN_API_URL}/googs/${postId}/comments`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch post comments');
        return result?.data || result || [];
    },

    fetchGoogPostLikes: async (postId: number) => {
        const response = await fetch(`${MAIN_API_URL}/googs/${postId}/likes`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch post likes');
        return result?.data || result || [];
    },

    fetchGoogPostShares: async (postId: number) => {
        const response = await fetch(`${MAIN_API_URL}/googs/${postId}/shares`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch post shares');
        return result?.data || result || [];
    },

    fetchGoogPostViews: async (postId: number) => {
        const response = await fetch(`${MAIN_API_URL}/googs/${postId}/views`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch post views');
        return result?.data || result || [];
    },

    deletePost: async (postId: number) => {
        const response = await fetch(`${API_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete post');
        return result;
    },

    deactivateUser: async (userId: number, deactivate: boolean, reason?: string, options?: { category?: string; customReason?: string }) => {
        const response = await fetch(`${API_URL}/users/${userId}/deactivate`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ deactivate, reason, ...(options || {}) }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update user status');
        return result;
    },

    reviewUserAppeal: async (userId: number, action: 'approve' | 'reject', adminNote?: string) => {
        const response = await fetch(`${API_URL}/users/${userId}/appeal`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ action, adminNote }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to review appeal');
        return result;
    },

    updateSuspendedWalletAccess: async (userId: number, enabled: boolean) => {
        const response = await fetch(`${API_URL}/users/${userId}/wallet-access`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ enabled }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update wallet access');
        return result;
    },

    adminTogglePost: async (postId: number) => {
        const response = await fetch(`${API_URL}/posts/${postId}/toggle-active`, {
            method: 'PATCH',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to toggle post');
        return result;
    },

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
            headers: getHeaders(),
            cache: 'no-store',
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

    fetchCoinCollectDetail: async () => {
        const response = await fetch(`${API_URL}/admin/coin-collect-detail`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch coin detail');
        return result || [];
    },

    fetchProfilePromoteDetail: async () => {
        const response = await fetch(`${API_URL}/admin/profile-promote-detail`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch profile promote detail');
        return result || [];
    },

    fetchAdPromoteCollectionDetail: async () => {
        const response = await fetch(`${API_URL}/admin/ad-promote-collection-detail`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch ad promote collection detail');
        return result || [];
    },

    fetchProductCommissionHistory: async () => {
        const response = await fetch(`${API_URL}/admin/product-commission-history`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch product commission history');
        return result || [];
    },

    addWalletCapital: async (amount: number) => {
        return runFinanceMutation('admin.add-wallet-capital', { amount }, async (idempotencyKey) => {
            const response = await fetch(`${API_URL}/admin/add-wallet-capital`, {
                method: 'POST',
                headers: { ...getHeaders(), 'X-Idempotency-Key': idempotencyKey },
                body: JSON.stringify({ amount }),
            });
            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to add capital');
            return result;
        });
    },

    fetchAllUsersList: async () => {
        const response = await fetch(`${API_URL}/admin/all-users-list`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch users');
        return result || [];
    },

    fetchUserTransferHistory: async () => {
        const response = await fetch(`${API_URL}/admin/user-transfer-history`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch transfer history');
        return result || [];
    },

    fetchCapitalTransferHistory: async () => {
        const response = await fetch(`${API_URL}/admin/capital-transfer-history`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch transfer history');
        return result || [];
    },

    fetchCapitalAddHistory: async () => {
        const response = await fetch(`${API_URL}/admin/capital-add-history`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch capital add history');
        return result || [];
    },

    fetchP2PBuyTransactions: async () => {
        const response = await fetch(`${API_URL}/admin/p2p-buy-transactions`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch buy coins transactions');
        return result?.data || [];
    },

    fetchP2PSellTransactions: async () => {
        const response = await fetch(`${API_URL}/admin/p2p-sell-transactions`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch sell coins transactions');
        return result?.data || [];
    },

    transferGoogerToAdmin: async (adminId: number, amount: number) => {
        return runFinanceMutation('admin.transfer-googer-to-admin', { adminId, amount }, async (idempotencyKey) => {
            const response = await fetch(`${API_URL}/admin/transfer-googer-to-admin`, {
                method: 'POST',
                headers: { ...getHeaders(), 'X-Idempotency-Key': idempotencyKey },
                body: JSON.stringify({ adminId, amount })
            });
            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to transfer to admin');
            return result;
        });
    },

    fetchUserTransactions: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}/transactions`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch transactions');
        return result;
    },

    // Customization / Category Management
    fetchPublicCustomizationOverview: async () => {
        const response = await fetch(`${API_URL}/admin/customization/public-overview`, {
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch customization data');
        return result;
    },

    fetchCustomizationOverview: async () => {
        const response = await fetch(`${API_URL}/admin/customization/overview`, {
            cache: 'no-store',
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch customization data');
        return result;
    },

    fetchCommissionSettings: async () => {
        const response = await fetch(`${API_URL}/admin/customization/commissions`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch commission settings');
        return result;
    },

    fetchAdCoinRewardSettings: async () => {
        const response = await fetch(`${API_URL}/admin/customization/ad-coin-rewards`, {
            headers: getHeaders()
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch ad coin reward settings');
        return result;
    },

    createCategory: async (payload: { level: number; name: string; parentId?: number | null; commissionPercent?: number }) => {
        const response = await fetch(`${API_URL}/admin/customization/categories`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create category');
        return result;
    },

    updateCategory: async (id: number, payload: { name?: string; parentId?: number | null; commissionPercent?: number }) => {
        const response = await fetch(`${API_URL}/admin/customization/categories/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update category');
        return result;
    },

    deleteCategory: async (id: number) => {
        const response = await fetch(`${API_URL}/admin/customization/categories/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete category');
        return result;
    },

    updateGoogleCommission: async (value: number) => {
        const response = await fetch(`${API_URL}/admin/customization/google-commission`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update Google commission');
        return result;
    },

    resetGoogleCommission: async () => {
        const response = await fetch(`${API_URL}/admin/customization/google-commission`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to reset Google commission');
        return result;
    },

    updateAdCommission: async (payload: {
        referralMultiplier: number;
        adClickCommission: number;
        preAdCommission: number;
        generalCategoryCommission: number;
        manualCategoryCommissionEnabled?: boolean;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/ad-commission`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update commission settings');
        return result;
    },

    updateAdCoinRewardSettings: async (payload: {
        userRewardAmount: number;
        googerCommissionAmount: number;
        advertiserChargeAmount: number;
        requiredWatchSeconds: number;
        resellGoogerCommissionPercentage?: number;
        allowMismatch?: boolean;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/ad-coin-rewards`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update ad coin reward settings');
        return result;
    },

    updateCategoryCommission: async (id: number, commissionPercent: number) => {
        const response = await fetch(`${API_URL}/admin/customization/categories/${id}/commission`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ commissionPercent }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update category commission');
        return result;
    },

    // Reach Settings
    fetchReachSettings: async () => {
        const response = await fetch(`${API_URL}/admin/customization/reach-settings`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch reach settings');
        return result;
    },

    updateReachSettings: async (ad_type: string, payload: { min_multiplier: number; max_multiplier: number }) => {
        const response = await fetch(`${API_URL}/admin/customization/reach-settings/${encodeURIComponent(ad_type)}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update reach settings');
        return result;
    },

    // Reach Tiers
    fetchReachTiers: async (ad_type?: string) => {
        const qs = ad_type ? `?ad_type=${encodeURIComponent(ad_type)}` : '';
        const response = await fetch(`${API_URL}/admin/customization/reach-tiers${qs}`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch reach tiers');
        return result;
    },

    createReachTier: async (payload: {
        ad_type: string;
        budget_from: number; budget_to: number;
        min_days: number; max_days: number;
        min_multiplier: number; max_multiplier: number;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/reach-tiers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create reach tier');
        return result;
    },

    updateReachTier: async (id: number, payload: {
        budget_from: number; budget_to: number;
        min_days: number; max_days: number;
        min_multiplier: number; max_multiplier: number;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/reach-tiers/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update reach tier');
        return result;
    },

    setReachTierMaxCap: async (id: number, max_reach_multiplier: number | null) => {
        const response = await fetch(`${API_URL}/admin/customization/reach-tiers/${id}/max-reach-cap`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ max_reach_multiplier }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update max reach cap');
        return result;
    },

    deleteReachTier: async (id: number) => {
        const response = await fetch(`${API_URL}/admin/customization/reach-tiers/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete reach tier');
        return result;
    },

    // Promo Code Management
    fetchPromoCodes: async () => {
        const response = await fetch(`${API_URL}/admin/customization/promo-codes`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch promo codes');
        return result;
    },

    createPromoCode: async (payload: {
        code: string;
        ad_type: string;
        discount_value: number;
        max_uses?: number | null;
        expires_at?: string | null;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/promo-codes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create promo code');
        return result;
    },

    updatePromoCode: async (id: number, payload: {
        code?: string;
        discount_value?: number;
        is_active?: boolean;
        max_uses?: number | null;
        expires_at?: string | null;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/promo-codes/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update promo code');
        return result;
    },

    deletePromoCode: async (id: number) => {
        const response = await fetch(`${API_URL}/admin/customization/promo-codes/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete promo code');
        return result;
    },

    fetchUploadControlSettings: async () => {
        const sources = [
            `${API_URL}/admin/customization/upload-control`,
            `${MAIN_API_URL}/admin/customization/upload-control/public`,
        ];
        let lastError = 'Failed to fetch upload control settings';

        for (const source of sources) {
            try {
                const response = await fetch(source, {
                    headers: getHeaders(),
                    cache: 'no-store',
                });
                const result = await safeJson(response);
                if (!response.ok) {
                    lastError = result?.message || lastError;
                    continue;
                }
                return { success: true, settings: result?.settings || result };
            } catch (error: any) {
                lastError = error?.message || lastError;
            }
        }

        throw new Error(lastError);
    },

    updateUploadControlSettings: async (payload: {
        minUploadPrice: number;
        maxUploadPrice: number;
        flashContentPrice?: number;
        flashPreviewSeconds?: number;
        flashAutoPlay?: boolean;
        normalUserVideoLimitSeconds?: number;
        subscribedUserVideoLimitSeconds?: number;
        defaultTopic?: string;
        defaultContentAccessMode?: 'blurred' | 'unblurred';
        commissionTiers?: Array<{ min: number; max: number; commission: number }>;
        subscriptionCommissionTiers?: Array<{ min: number; max: number; commission: number }>;
        flashCommissionTiers?: Array<{ min: number; max: number; commission: number }>;
    }) => {
        const response = await fetch(`${API_URL}/admin/customization/upload-control`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update upload control settings');

        const mainResponse = await fetch(`${MAIN_API_URL}/admin/customization/upload-control`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const mainResult = await safeJson(mainResponse);
        if (!mainResponse.ok) {
            console.warn('[Upload Control] Main backend sync failed:', mainResult?.message || mainResponse.statusText);
        }

        return result;
    },

    fetchAdminUploadContents: async (status?: string) => {
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        const response = await fetch(`${API_URL}/admin/customization/upload-contents${qs.toString() ? `?${qs.toString()}` : ''}`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload contents');
        return result?.contents || [];
    },

    fetchAdminUploadContentMedia: async (contentId: string) => {
        const response = await fetch(`${API_URL}/admin/customization/upload-contents/${encodeURIComponent(contentId)}/media`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload content media');
        return result?.media || result;
    },

    updateUploadContentStatus: async (contentId: string, payload: { status: 'Approved' | 'Rejected'; rejectionReason?: string; adminNote?: string }) => {
        const response = await fetch(`${API_URL}/admin/customization/upload-contents/${encodeURIComponent(contentId)}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update upload content status');
        return result?.content || result;
    },

    deleteUploadContent: async (contentId: string) => {
        const response = await fetch(`${API_URL}/admin/customization/upload-contents/${encodeURIComponent(contentId)}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete upload content');
        return result;
    },

    fetchUploadContentLikes: async (contentId: string) => {
        const response = await fetch(`${MAIN_API_URL}/upload-content/${encodeURIComponent(contentId)}/likes`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload content likes');
        return result?.likes || [];
    },

    fetchUploadContentComments: async (contentId: string) => {
        const response = await fetch(`${MAIN_API_URL}/upload-content/${encodeURIComponent(contentId)}/comments`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload content comments');
        return result?.comments || [];
    },

    fetchUploadContentShares: async (contentId: string) => {
        const response = await fetch(`${MAIN_API_URL}/upload-content/${encodeURIComponent(contentId)}/shares`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload content shares');
        return result?.shares || [];
    },

    fetchUploadContentViews: async (contentId: string) => {
        const response = await fetch(`${MAIN_API_URL}/upload-content/${encodeURIComponent(contentId)}/views`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch upload content views');
        return result?.views || [];
    },

    // Withdrawal Admin
    fetchWithdrawalSettings: async () => {
        const response = await fetch(`${API_URL}/withdrawal-admin/settings`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch withdrawal settings');
        return result?.data;
    },

    updateWithdrawalSettings: async (min_amount: number, max_amount: number) => {
        const response = await fetch(`${API_URL}/withdrawal-admin/settings`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ min_amount, max_amount }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update settings');
        return result?.data;
    },

    fetchWithdrawalPaymentMethods: async () => {
        const response = await fetch(`${API_URL}/withdrawal-admin/payment-methods`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch payment methods');
        return result?.data || [];
    },

    createWithdrawalPaymentMethod: async (payload: { name: string; icon: string; fields: any[]; is_active: boolean }) => {
        const response = await fetch(`${API_URL}/withdrawal-admin/payment-methods`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create payment method');
        return result?.data;
    },

    updateWithdrawalPaymentMethod: async (id: number, payload: Partial<{ name: string; icon: string; fields: any[]; is_active: boolean }>) => {
        const response = await fetch(`${API_URL}/withdrawal-admin/payment-methods/${id}`, {
            method: 'PATCH', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update payment method');
        return result?.data;
    },

    deleteWithdrawalPaymentMethod: async (id: number) => {
        const response = await fetch(`${API_URL}/withdrawal-admin/payment-methods/${id}`, {
            method: 'DELETE', headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete payment method');
        return result;
    },

    fetchWithdrawalRequests: async (status?: string) => {
        const qs = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : '';
        const response = await fetch(`${API_URL}/withdrawal-admin/requests${qs}`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch requests');
        return result?.data || [];
    },

    reviewWithdrawalRequest: async (id: number, action: 'approve' | 'reject', rejectionReason?: string) => {
        return runFinanceMutation('admin.review-withdrawal-request', { id, action, rejectionReason: rejectionReason || null }, async (idempotencyKey) => {
            const response = await fetch(`${API_URL}/withdrawal-admin/requests/${id}/review`, {
                method: 'PUT', headers: { ...getHeaders(), 'X-Idempotency-Key': idempotencyKey },
                body: JSON.stringify({ action, rejectionReason }),
            });
            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to process request');
            return result?.data;
        });
    },

    fetchWithdrawalTransactions: async () => {
        const response = await fetch(`${API_URL}/withdrawal-admin/transactions`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch transactions');
        return result?.data || [];
    },

    // Verification Management
    fetchAllVerifications: async (status?: string) => {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        const response = await fetch(`${API_URL}/verification/admin/all${qs}`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch verifications');
        return result?.data || [];
    },

    fetchUserVerification: async (userId: string | number) => {
        const response = await fetch(`${API_URL}/verification/admin/user/${userId}`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'No verification found');
        return result?.data;
    },

    reviewVerification: async (id: string | number, action: 'approve' | 'reject', rejectionReason?: string) => {
        const response = await fetch(`${API_URL}/verification/admin/${id}/review`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ action, rejectionReason }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update verification');
        return result?.data;
    },

    // Topup Payment Methods
    fetchTopupPaymentMethods: async () => {
        const response = await fetch(`${API_URL}/coin-requests/topup-methods`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch topup methods');
        return result?.data || [];
    },

    createTopupPaymentMethod: async (payload: { name: string; icon: string; category: string; fields: any[]; is_active: boolean }) => {
        const response = await fetch(`${API_URL}/coin-requests/topup-methods`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create topup method');
        return result?.data;
    },

    updateTopupPaymentMethod: async (id: number, payload: Partial<{ name: string; icon: string; category: string; fields: any[]; is_active: boolean }>) => {
        const response = await fetch(`${API_URL}/coin-requests/topup-methods/${id}`, {
            method: 'PATCH', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update topup method');
        return result?.data;
    },

    deleteTopupPaymentMethod: async (id: number) => {
        const response = await fetch(`${API_URL}/coin-requests/topup-methods/${id}`, {
            method: 'DELETE', headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete topup method');
        return result;
    },

    // Coin Requests (admin)
    fetchCoinRequests: async (status?: string) => {
        const qs = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : '';
        const response = await fetch(`${API_URL}/coin-requests/admin/requests${qs}`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch coin requests');
        return result?.data || [];
    },

    reviewCoinRequest: async (id: number, action: 'approve' | 'reject', rejection_reason?: string) => {
        return runFinanceMutation('admin.review-coin-request', { id, action, rejection_reason: rejection_reason || null }, async (idempotencyKey) => {
            const response = await fetch(`${API_URL}/coin-requests/admin/${id}/review`, {
                method: 'PUT', headers: { ...getHeaders(), 'X-Idempotency-Key': idempotencyKey },
                body: JSON.stringify({ action, rejection_reason }),
            });
            const result = await safeJson(response);
            if (!response.ok) throw new Error(result?.message || 'Failed to process request');
            return result?.data;
        });
    },

    // Subscription Plans
    fetchSubscriptionPlans: async () => {
        const response = await fetch(`${API_URL}/admin/subscription-plans`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch subscription plans');
        return result;
    },

    createSubscriptionPlan: async (payload: {
        slug: string; name: string; price: number; duration_days?: number;
        badge_color?: string; accent_color?: string; googs_limit?: number;
        verified_tick?: boolean; features?: string[]; extra?: Record<string, any>;
        is_active?: boolean; sort_order?: number;
    }) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create subscription plan');
        return result;
    },

    updateSubscriptionPlan: async (id: number, payload: Partial<{
        slug: string; name: string; price: number; duration_days: number;
        badge_color: string; accent_color: string; googs_limit: number;
        verified_tick: boolean; features: string[]; extra: Record<string, any>;
        is_active: boolean; sort_order: number;
    }>) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update subscription plan');
        return result;
    },

    deleteSubscriptionPlan: async (id: number) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete subscription plan');
        return result;
    },

    seedBasicPlan: async () => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/seed-basic`, {
            method: 'POST',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to seed basic plan');
        return result;
    },

    fetchSubscriptionPurchases: async () => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/purchases`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch purchases');
        return result;
    },

    assignSubscriptionPlan: async (user_id: number, plan_id: number) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/assign`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ user_id, plan_id }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to assign plan');
        return result;
    },

    removeSubscriptionAssign: async (userId: number) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/assign/${userId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to remove subscription');
        return result;
    },

    togglePurchaseStatus: async (purchaseId: number) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/purchases/${purchaseId}/toggle-status`, {
            method: 'PATCH',
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to toggle subscription status');
        return result;
    },

    assignVerificationBadge: async (userId: number, is_verified: boolean, verification_badge_color?: string | null, verification_badge_tick_color?: string | null) => {
        const response = await fetch(`${API_URL}/admin/subscription-plans/assign-badge/${userId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ is_verified, verification_badge_color, verification_badge_tick_color }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to assign verification badge');
        return result;
    },

    // â”€â”€ Referrals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // â”€â”€ Customization: Referral Level Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fetchRefLevels: async () => {
        const response = await fetch(`${API_URL}/admin/customization/referral-level-settings`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch referral levels');
        return result;
    },

    addRefLevel: async (payload: { level: number; name: string; commission_percentage: number; ad_commission_percentage: number; is_active: boolean; sort_order: number }) => {
        const response = await fetch(`${API_URL}/admin/customization/referral-level-settings`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to add level');
        return result;
    },

    bulkSaveRefLevels: async (levels: Array<{ level: number; name: string; commission_percentage: number; ad_commission_percentage: number; is_active: boolean; sort_order: number }>) => {
        const response = await fetch(`${API_URL}/admin/customization/referral-level-settings/bulk`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ levels }),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to bulk save levels');
        return result;
    },

    updateRefLevel: async (level: number, payload: Partial<{ name: string; commission_percentage: number; ad_commission_percentage: number; is_active: boolean; sort_order: number }>) => {
        const response = await fetch(`${API_URL}/admin/customization/referral-level-settings/${level}`, {
            method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update level');
        return result;
    },

    deleteRefLevel: async (level: number) => {
        const response = await fetch(`${API_URL}/admin/customization/referral-level-settings/${level}`, {
            method: 'DELETE', headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete level');
        return result;
    },

    // â”€â”€ Customization: Referral Commission Pool Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fetchRefCommissionSettings: async () => {
        const response = await fetch(`${API_URL}/admin/customization/referral-commission-settings`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch commission settings');
        return result;
    },

    updateRefCommissionSettings: async (payload: { productPurchasePoolPercentage: number; adPurchasePoolPercentage: number }) => {
        const response = await fetch(`${API_URL}/admin/customization/referral-commission-settings`, {
            method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to save commission settings');
        return result;
    },

    // â”€â”€ Legacy referral settings (kept for backward compat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fetchReferralSettings: async () => {
        const response = await fetch(`${API_URL}/admin/referrals/settings`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch referral settings');
        return result;
    },

    createReferralLevel: async (payload: {
        level: number; name: string; commission_percentage: number;
        ad_commission_percentage: number; is_active: boolean; sort_order: number;
    }) => {
        const response = await fetch(`${API_URL}/admin/referrals/settings`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to create referral level');
        return result;
    },

    updateReferralLevel: async (id: number, payload: Partial<{
        name: string; commission_percentage: number; ad_commission_percentage: number;
        is_active: boolean; sort_order: number;
    }>) => {
        const response = await fetch(`${API_URL}/admin/referrals/settings/${id}`, {
            method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to update referral level');
        return result;
    },

    deleteReferralLevel: async (id: number) => {
        const response = await fetch(`${API_URL}/admin/referrals/settings/${id}`, {
            method: 'DELETE', headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to delete referral level');
        return result;
    },

    fetchReferralStats: async () => {
        const response = await fetch(`${API_URL}/admin/referrals/stats`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch referral stats');
        return result;
    },

    fetchReferralMapping: async () => {
        const response = await fetch(`${API_URL}/admin/referrals/mapping`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch referral mapping');
        return result;
    },

    fetchTopEarners: async (limit = 10) => {
        const response = await fetch(`${API_URL}/admin/referrals/top-earners?limit=${limit}`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch top earners');
        return result;
    },

    fetchTopReferrers: async (limit = 10) => {
        const response = await fetch(`${API_URL}/admin/referrals/top-referrers?limit=${limit}`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch top referrers');
        return result;
    },

    fetchBuyerLine: async (userId: number) => {
        const response = await fetch(`${API_URL}/admin/referrals/buyer-line/${userId}`, { headers: getHeaders() });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch buyer line');
        return result;
    },

    previewCommission: async (buyerId: number, type: 'product' | 'ad', amount: number) => {
        const response = await fetch(
            `${API_URL}/admin/referrals/commission-preview?buyerId=${buyerId}&type=${type}&amount=${amount}`,
            { headers: getHeaders() }
        );
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to preview commission');
        return result;
    },

    fetchCommissionPayouts: async (page = 1, limit = 20) => {
        const response = await fetch(
            `${API_URL}/admin/referrals/commission-payouts?page=${page}&limit=${limit}`,
            { headers: getHeaders() }
        );
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch commission payouts');
        return result;
    },
    fetchTrafficAnalysis: async () => {
        const response = await fetch(`${API_URL}/admin/traffic-analysis`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch traffic analysis');
        return result;
    },

    // Lightweight presence counts for the live monitor — safe to poll every 1-3s.
    fetchTrafficPulse: async () => {
        const response = await fetch(`${API_URL}/admin/traffic-analysis/pulse`, {
            headers: getHeaders(),
            cache: 'no-store',
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch traffic pulse');
        return result;
    },

    fetchAllWalletTransactions: async () => {
        const response = await fetch(`${API_URL}/admin/all-transactions`, {
            headers: getHeaders(),
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch all wallet transactions');
        return result?.transactions || [];
    },
};
