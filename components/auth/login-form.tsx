"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

type LoginApiResponse = {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    role: string | null;
    branchId: string | null;
  };
  fieldErrors?: Partial<Record<keyof LoginInput, string>>;
};

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const data = (await response.json().catch(() => null)) as LoginApiResponse | null;

    if (!response.ok || !data?.success) {
      clearErrors();
      let hasFieldErrors = false;

      if (data?.fieldErrors) {
        for (const [field, message] of Object.entries(data.fieldErrors)) {
          if (!message) {
            continue;
          }

          hasFieldErrors = true;
          setError(field as keyof LoginInput, {
            type: "server",
            message,
          });
        }
      }

      setServerError(hasFieldErrors ? null : data?.message ?? "Unable to sign in right now. Please try again shortly.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="username">
          Username
        </label>
        <Input
          id="username"
          autoComplete="username"
          placeholder="Enter your username"
          {...register("username")}
        />
        {errors.username ? <p className="text-sm text-red-600">{errors.username.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
