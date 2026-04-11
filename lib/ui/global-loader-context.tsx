"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LoaderOptions = {
  autoHideOnRouteChange?: boolean;
};

type LoaderState = {
  message: string;
  autoHideOnRouteChange: boolean;
};

type GlobalLoaderContextValue = {
  blockingLoader: LoaderState | null;
  nonBlockingLoader: LoaderState | null;
  showBlockingLoader: (message?: string, options?: LoaderOptions) => void;
  hideBlockingLoader: () => void;
  showNonBlockingLoader: (message?: string, options?: LoaderOptions) => void;
  hideNonBlockingLoader: () => void;
};

const DEFAULT_BLOCKING_MESSAGE = "Loading...";
const DEFAULT_NON_BLOCKING_MESSAGE = "Working in the background...";

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | undefined>(undefined);

function GlobalLoaderRouteWatcher({ onRouteChange }: { onRouteChange: (routeSignature: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeSignature = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    onRouteChange(routeSignature);
  }, [onRouteChange, routeSignature]);

  return null;
}

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const previousRouteRef = useRef<string | null>(null);
  const [blockingLoader, setBlockingLoader] = useState<LoaderState | null>(null);
  const [nonBlockingLoader, setNonBlockingLoader] = useState<LoaderState | null>(null);

  const handleRouteChange = useCallback((routeSignature: string) => {
    if (previousRouteRef.current === null) {
      previousRouteRef.current = routeSignature;
      return;
    }

    if (previousRouteRef.current === routeSignature) {
      return;
    }

    previousRouteRef.current = routeSignature;
    setBlockingLoader((currentLoader) => (currentLoader?.autoHideOnRouteChange ? null : currentLoader));
    setNonBlockingLoader((currentLoader) => (currentLoader?.autoHideOnRouteChange ? null : currentLoader));
  }, []);

  useEffect(() => {
    if (!blockingLoader) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [blockingLoader]);

  return (
    <GlobalLoaderContext.Provider
      value={{
        blockingLoader,
        nonBlockingLoader,
        showBlockingLoader: (message = DEFAULT_BLOCKING_MESSAGE, options) => {
          setBlockingLoader({
            message,
            autoHideOnRouteChange: options?.autoHideOnRouteChange ?? false,
          });
        },
        hideBlockingLoader: () => {
          setBlockingLoader(null);
        },
        showNonBlockingLoader: (message = DEFAULT_NON_BLOCKING_MESSAGE, options) => {
          setNonBlockingLoader({
            message,
            autoHideOnRouteChange: options?.autoHideOnRouteChange ?? false,
          });
        },
        hideNonBlockingLoader: () => {
          setNonBlockingLoader(null);
        },
      }}
    >
      <Suspense fallback={null}>
        <GlobalLoaderRouteWatcher onRouteChange={handleRouteChange} />
      </Suspense>
      {children}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const context = useContext(GlobalLoaderContext);

  if (!context) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider");
  }

  return context;
}
