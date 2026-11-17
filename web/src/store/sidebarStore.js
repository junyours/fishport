import { create } from "zustand";

const SIDEBAR_GROUPS_KEY = "opol:sidebar-groups";

const getInitialOpenGroups = () => {
  try {
    if (!sessionStorage.getItem("token")) return {};
    const groups = JSON.parse(sessionStorage.getItem(SIDEBAR_GROUPS_KEY) ?? "{}");
    return Object.fromEntries(Object.entries(groups).filter(([, open]) => typeof open === "boolean"));
  } catch {
    return {};
  }
};

const getInitialCollapsedState = () => {
  try {
    return localStorage.getItem("sidebarCollapsed") === "true";
  } catch {
    return false;
  }
};

const getInitialOpenState = () => {
  if (typeof window === "undefined") {
    return true;
  }

  return window.innerWidth >= 900;
};

// Sidebar UI state lives in Zustand because it is shared client-side state.
export const useSidebarStore = create((set, get) => ({
  sidebarCollapsed: getInitialCollapsedState(),
  sidebarOpen: getInitialOpenState(),
  openGroups: getInitialOpenGroups(),

  setGroupOpen: (group, open) => {
    const openGroups = { ...get().openGroups, [group]: open };
    try {
      // The previous screen can still be mounted while sign-out navigation finishes.
      if (!sessionStorage.getItem("token")) return;
      sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {}
    set({ openGroups });
  },

  resetGroups: () => {
    try {
      sessionStorage.removeItem(SIDEBAR_GROUPS_KEY);
    } catch {}
    if (Object.keys(get().openGroups).length) set({ openGroups: {} });
  },

  setSidebarCollapsed: (value) => {
    set({ sidebarCollapsed: value });

    try {
      localStorage.setItem("sidebarCollapsed", String(value));
    } catch {}
  },

  setSidebarOpen: (value) => set({ sidebarOpen: value }),

  toggleSidebar: () =>
    set((state) => {
      if (typeof window !== "undefined" && window.innerWidth >= 900) {
        const nextCollapsed = !state.sidebarCollapsed;

        try {
          localStorage.setItem("sidebarCollapsed", String(nextCollapsed));
        } catch {}

        return { sidebarCollapsed: nextCollapsed };
      }

      return { sidebarOpen: !state.sidebarOpen };
    }),

  syncSidebarViewport: () => {
    if (typeof window === "undefined") {
      return;
    }

    set({ sidebarOpen: window.innerWidth >= 900 });
  },
}));

// Thin wrapper hook keeps consuming components readable.
export const useSidebar = () => useSidebarStore();
