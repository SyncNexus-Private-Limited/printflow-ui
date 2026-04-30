"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  type TransitionStartFunction,
} from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isSameHref } from "@/lib/dashboard/href-utils";

type UseFilterDrawerOptions<TFilters, TDraft> = {
  currentHref: string;
  currentFilters: TFilters;
  toDraftFilters: (filters: TFilters) => TDraft;
};

type UseFilterDrawerReturn<TDraft> = {
  filterPanelId: string;
  filterTitleId: string;
  filterButtonRef: RefObject<HTMLButtonElement>;
  filterCloseButtonRef: RefObject<HTMLButtonElement>;
  isOpen: boolean;
  draftFilters: TDraft;
  setDraftFilters: Dispatch<SetStateAction<TDraft>>;
  isPending: boolean;
  pendingAction: "apply" | null;
  setPendingAction: Dispatch<SetStateAction<"apply" | null>>;
  isApplyPending: boolean;
  handleFilterToggle: () => void;
  closeDrawer: () => void;
  navigateToHref: (href: string) => boolean;
  startTransition: TransitionStartFunction;
};

export function useFilterDrawer<TFilters, TDraft>({
  currentHref,
  currentFilters,
  toDraftFilters,
}: UseFilterDrawerOptions<TFilters, TDraft>): UseFilterDrawerReturn<TDraft> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseId = useId();
  const filterPanelId = `${baseId}-filter-panel`;
  const filterTitleId = `${baseId}-filter-title`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previousOpenPanelRef = useRef<"filter" | null>(null);
  const toDraftFiltersRef = useRef(toDraftFilters);
  toDraftFiltersRef.current = toDraftFilters;
  const [openPanel, setOpenPanel] = useState<"filter" | null>(null);
  const [draftFilters, setDraftFilters] = useState<TDraft>(() => toDraftFilters(currentFilters));
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftFilters(toDraftFiltersRef.current(currentFilters));
  }, [currentFilters]);

  useEffect(() => {
    setOpenPanel(null);
  }, [routeSignature]);

  useEffect(() => {
    if (!isPending) {
      setPendingAction(null);
    }
  }, [isPending]);

  useEffect(() => {
    if (openPanel !== "filter") {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    const focusTimeout = window.setTimeout(() => {
      filterCloseButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openPanel]);

  useEffect(() => {
    if (previousOpenPanelRef.current === "filter" && openPanel !== "filter") {
      filterButtonRef.current?.focus();
    }

    previousOpenPanelRef.current = openPanel;
  }, [openPanel]);

  const navigateToHref = (href: string): boolean => {
    if (isSameHref(href, currentHref)) {
      setOpenPanel(null);
      return false;
    }

    if (openPanel === "filter") {
      flushSync(() => {
        setOpenPanel(null);
      });
    }

    router.replace(href, { scroll: false });
    return true;
  };

  const handleFilterToggle = () => {
    setOpenPanel((current) => (current === "filter" ? null : "filter"));
  };

  const closeDrawer = () => setOpenPanel(null);

  return {
    filterPanelId,
    filterTitleId,
    filterButtonRef,
    filterCloseButtonRef,
    isOpen: openPanel === "filter",
    draftFilters,
    setDraftFilters,
    isPending,
    pendingAction,
    setPendingAction,
    isApplyPending: isPending && pendingAction === "apply",
    handleFilterToggle,
    closeDrawer,
    navigateToHref,
    startTransition,
  };
}
