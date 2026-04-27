"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShellUiState = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  commandMenuOpen: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (value: boolean) => void;
  setCommandMenuOpen: (value: boolean) => void;
};

export const useShellUiState = create<ShellUiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      commandMenuOpen: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebarOpen: (value) => set({ mobileSidebarOpen: value }),
      setCommandMenuOpen: (value) => set({ commandMenuOpen: value }),
    }),
    { name: "dealseal-shell-ui" },
  ),
);
