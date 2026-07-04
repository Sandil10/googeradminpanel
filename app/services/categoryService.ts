const API_URL = '/api';
const CATEGORY_TREE_EVENT = 'googer:category-tree-updated';
const CATEGORY_TREE_STORAGE_KEY = 'googer:category-tree-version';
const isClient = typeof window !== 'undefined';

const safeJson = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    return null;
};

export const categoryService = {
    fetchCategoryTree: async () => {
        const response = await fetch(`${API_URL}/categories/tree?ts=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            },
        });
        const result = await safeJson(response);
        if (!response.ok) throw new Error(result?.message || 'Failed to fetch categories');
        return result?.categories || [];
    },

    notifyCategoryTreeChanged: () => {
        if (!isClient) return;

        const version = String(Date.now());
        try {
            localStorage.setItem(CATEGORY_TREE_STORAGE_KEY, version);
        } catch (error) {
            // Ignore storage failures and still notify same-tab listeners.
        }

        window.dispatchEvent(new CustomEvent(CATEGORY_TREE_EVENT, { detail: version }));
    },

    subscribeToCategoryTreeChanges: (callback: () => void) => {
        if (!isClient) return () => {};

        const customHandler = () => callback();
        const storageHandler = (event: StorageEvent) => {
            if (event.key === CATEGORY_TREE_STORAGE_KEY) {
                callback();
            }
        };

        window.addEventListener(CATEGORY_TREE_EVENT, customHandler);
        window.addEventListener('storage', storageHandler);

        return () => {
            window.removeEventListener(CATEGORY_TREE_EVENT, customHandler);
            window.removeEventListener('storage', storageHandler);
        };
    },
};
