"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className = "btn", disabled }: { children: React.ReactNode; pending: string; className?: string; disabled?: boolean }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`} disabled={disabled || isPending}>
      {isPending ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> {pending}
        </>
      ) : (
        children
      )}
    </button>
  );
}
