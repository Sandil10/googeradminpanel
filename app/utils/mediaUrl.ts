const cleanManagedMediaUrl = (value: string) => {
    let cleaned = String(value || "").trim().replace(/\s/g, "").replace(/[\\"]/g, "");
    if (cleaned.startsWith("data:") && cleaned.includes("base64") && !cleaned.includes("base64,")) {
        cleaned = cleaned.replace("base64", "base64,");
    }
    return cleaned;
};

export const toManagedMediaUrl = (value?: string | null) => {
    if (!value || typeof value !== "string") return "";

    const cleaned = cleanManagedMediaUrl(value);
    if (!cleaned) return "";

    if (
        cleaned.startsWith("http://")
        || cleaned.startsWith("https://")
        || cleaned.startsWith("data:")
        || cleaned.startsWith("blob:")
        || cleaned.startsWith("/uploads/")
        || cleaned.startsWith("/upload/")
    ) {
        return cleaned;
    }

    if (cleaned.startsWith("/")) {
        return `/uploads/${cleaned.replace(/^\/+/, "")}`;
    }

    const normalized = cleaned.replace(/\\/g, "/");
    const uploadIndex = normalized.toLowerCase().indexOf("uploads/");
    if (uploadIndex >= 0) {
        return `/${normalized.slice(uploadIndex)}`;
    }

    return `/uploads/${normalized.split("/").pop()}`;
};
