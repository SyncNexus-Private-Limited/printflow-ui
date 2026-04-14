export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function suggestCanonicalClasses(...classes: Array<string | false | null | undefined>) {
  return cn(...classes);
}
