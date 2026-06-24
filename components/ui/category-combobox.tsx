"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ExpenseCategoryOption } from "@/lib/expenses/types";

type CategoryComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ExpenseCategoryOption[];
  disabled?: boolean;
  placeholder?: string;
};

export function CategoryCombobox({
  id,
  value,
  onChange,
  onBlur,
  options,
  disabled = false,
  placeholder = "Select a category",
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedOption = options.find((o) => o.id === value) ?? null;

  const filteredOptions =
    query.trim() === ""
      ? options
      : options.filter((o) => {
          const q = query.toLowerCase();
          return (
            o.name.toLowerCase().includes(q) ||
            (o.description != null && o.description.toLowerCase().includes(q))
          );
        });

  // Close on pointer-down outside
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[role=option]");
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function open() {
    if (!disabled) {
      setIsOpen(true);
      setActiveIndex(-1);
    }
  }

  function close() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
    onBlur?.();
  }

  function select(option: ExpenseCategoryOption) {
    onChange(option.id);
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open();
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          select(filteredOptions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        requestAnimationFrame(() => triggerRef.current?.focus());
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={open}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-left text-sm",
          "focus:border-[rgb(var(--primary))] focus:ring-4 focus:ring-[rgb(var(--primary)/0.14)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-[rgb(var(--muted))] disabled:text-[rgb(var(--muted-foreground))]",
          isOpen && "border-[rgb(var(--primary))] ring-4 ring-[rgb(var(--primary)/0.14)]",
          selectedOption
            ? "text-[rgb(var(--card-foreground))]"
            : "text-[rgb(var(--muted-foreground))]",
        )}
      >
        <span className="min-w-0 truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "ml-2 shrink-0 text-[rgb(var(--muted-foreground))] transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-3 py-2">
            <Search
              size={14}
              aria-hidden
              className="shrink-0 text-[rgb(var(--muted-foreground))]"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search categories…"
              autoComplete="off"
              aria-label="Search categories"
              className="min-w-0 flex-1 bg-transparent text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted-foreground))] focus:outline-none"
            />
          </div>

          {/* Option list */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Categories"
            className="max-h-56 overflow-y-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[rgb(var(--muted-foreground))]">
                No categories found.
              </li>
            ) : (
              filteredOptions.map((option, idx) => (
                <li
                  key={option.id}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={option.id === value}
                  onPointerDown={(e) => {
                    // Prevent search input from losing focus before selection fires
                    e.preventDefault();
                    select(option);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-3 py-2",
                    activeIndex === idx && "bg-[rgb(var(--muted)/0.5)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        option.id === value
                          ? "text-[rgb(var(--primary))]"
                          : "text-[rgb(var(--card-foreground))]",
                      )}
                    >
                      {option.name}
                    </p>
                    {option.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[rgb(var(--muted-foreground))]">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  {option.id === value ? (
                    <Check
                      size={14}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-[rgb(var(--primary))]"
                    />
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Helper text: selected category description shown below the trigger */}
      {selectedOption?.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--muted-foreground))]">
          {selectedOption.description}
        </p>
      ) : null}
    </div>
  );
}
