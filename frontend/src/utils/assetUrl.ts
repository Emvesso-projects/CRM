const getBackendOrigin = () => {
  return import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace("/api/v1", "").replace(/\/$/, "")
    : "http://localhost:5000";
};

const getR2CustomDomain = () => {
  const domain = import.meta.env.VITE_R2_PUBLIC_CUSTOM_DOMAIN;
  return domain ? domain.replace(/\/+$/, "") : null;
};

export const resolveAssetUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  const cleanUrl = url.replace(/^\/+/, "");

  // If it's already an explicit /uploads path
  if (cleanUrl.startsWith("uploads/")) {
    return `${getBackendOrigin()}/${cleanUrl}`;
  }

  const r2Domain = getR2CustomDomain();
  if (r2Domain && import.meta.env.VITE_STORAGE_PROVIDER === "r2") {
    return `${r2Domain}/${cleanUrl}`;
  }

  return `${getBackendOrigin()}/uploads/${cleanUrl}`;
};

