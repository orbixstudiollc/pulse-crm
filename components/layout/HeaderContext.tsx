"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

interface HeaderConfig {
  backHref?: string;
  actions?: ReactNode;
  breadcrumbLabel?: string;
}

interface HeaderContextType {
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
  resetConfig: () => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<HeaderConfig>({});

  const setConfig = useCallback((newConfig: HeaderConfig) => {
    setConfigState(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState({});
  }, []);

  return (
    <HeaderContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
