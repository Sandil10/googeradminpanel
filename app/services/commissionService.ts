"use client";

const COMMISSION_SETTINGS_EVENT = "googer:commission-settings-updated";
const COMMISSION_SETTINGS_STORAGE_KEY = "googer:commission-settings-version";
const isClient = typeof window !== "undefined";

export const commissionService = {
    notifyCommissionSettingsChanged: () => {
        if (!isClient) return;

        const version = String(Date.now());
        try {
            localStorage.setItem(COMMISSION_SETTINGS_STORAGE_KEY, version);
        } catch (error) {
            // Ignore storage failures and still notify same-tab listeners.
        }

        window.dispatchEvent(new CustomEvent(COMMISSION_SETTINGS_EVENT, { detail: version }));
    },

    subscribeToCommissionSettingsChanges: (callback: () => void) => {
        if (!isClient) return () => {};

        const customHandler = () => callback();
        const storageHandler = (event: StorageEvent) => {
            if (event.key === COMMISSION_SETTINGS_STORAGE_KEY) {
                callback();
            }
        };

        window.addEventListener(COMMISSION_SETTINGS_EVENT, customHandler);
        window.addEventListener("storage", storageHandler);

        return () => {
            window.removeEventListener(COMMISSION_SETTINGS_EVENT, customHandler);
            window.removeEventListener("storage", storageHandler);
        };
    },
};
