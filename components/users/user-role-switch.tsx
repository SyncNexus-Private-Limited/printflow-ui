"use client";

import { Briefcase, ShieldCheck, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  userRoleDescriptions,
  userRoleLabels,
  userRoleValues,
  type UserRole,
} from "@/lib/users/types";
import { cn } from "@/lib/utils/cn";

const roleIcons: Record<UserRole, LucideIcon> = {
  admin: ShieldCheck,
  manager: Briefcase,
  operator: Wrench,
  staff: Users,
};

type UserRoleSwitchProps = {
  value: UserRole;
  disabled?: boolean;
  onChange: (nextRole: UserRole) => void;
};

export function UserRoleSwitch({ value, disabled = false, onChange }: UserRoleSwitchProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account role">
      {userRoleValues.map((role) => {
        const isActive = role === value;
        const Icon = roleIcons[role];

        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!isActive) onChange(role);
            }}
            className={cn(
              "rounded-[22px] border px-4 py-4 text-left transition-colors",
              "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
              isActive
                ? "border-[rgb(var(--primary)/0.3)] bg-[rgb(var(--primary-soft))] shadow-[0_20px_42px_-38px_rgb(var(--shadow)/0.3)]"
                : "border-[rgb(var(--border)/0.82)] bg-[rgb(var(--card)/0.82)] hover:bg-[rgb(var(--muted)/0.72)]",
              disabled && "cursor-not-allowed opacity-70",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  isActive
                    ? "bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]"
                    : "bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]",
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                  {userRoleLabels[role]}
                </p>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                  {userRoleDescriptions[role]}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
