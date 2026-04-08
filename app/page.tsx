import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function HomePage() {
  const currentUser = await getCurrentUser({ touchSession: true });

  redirect(currentUser ? "/dashboard" : "/login");
}
