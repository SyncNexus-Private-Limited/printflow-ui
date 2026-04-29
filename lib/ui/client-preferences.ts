export type ThemeName = "light" | "dark";

export const DEFAULT_THEME: ThemeName = "light";
export const THEME_COOKIE_NAME = "printflow-theme";
export const DESKTOP_SIDEBAR_STORAGE_KEY = "printflow.dashboard.sidebar-collapsed";
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === "light" || value === "dark";
}

export function buildThemeCookieValue(theme: ThemeName, isSecure: boolean) {
  const cookieParts = [
    `${THEME_COOKIE_NAME}=${theme}`,
    "Path=/",
    `Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];

  if (isSecure) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

export function getPreHydrationUiBootstrapScript(
  hasThemeCookie: boolean,
  fallbackTheme: ThemeName,
) {
  const hasThemeCookieLiteral = hasThemeCookie ? "true" : "false";
  const fallbackThemeLiteral = JSON.stringify(fallbackTheme);
  const sidebarStorageKeyLiteral = JSON.stringify(DESKTOP_SIDEBAR_STORAGE_KEY);
  const themeCookieNameLiteral = JSON.stringify(THEME_COOKIE_NAME);
  const themeCookieMaxAgeLiteral = String(THEME_COOKIE_MAX_AGE_SECONDS);

  return `(() => {
  const root = document.documentElement;

  try {
    const theme = ${hasThemeCookieLiteral}
      ? ${fallbackThemeLiteral}
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : ${fallbackThemeLiteral};

    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    if (!${hasThemeCookieLiteral}) {
      document.cookie = ${themeCookieNameLiteral} + "=" + theme + "; Path=/; Max-Age=${themeCookieMaxAgeLiteral}; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
    }

    const isDesktopSidebarCollapsed = window.localStorage.getItem(${sidebarStorageKeyLiteral}) === "true";
    root.dataset.dashboardSidebarCollapsed = String(isDesktopSidebarCollapsed);
  } catch (_error) {
    root.dataset.theme = ${fallbackThemeLiteral};
    root.style.colorScheme = ${fallbackThemeLiteral};
    root.dataset.dashboardSidebarCollapsed = "false";
  }
})();`;
}
