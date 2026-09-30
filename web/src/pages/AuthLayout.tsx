import type { ReactNode } from "react";
import "./AuthLayout.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-col">
        <div className="auth-brand">
          <span className="auth-mark">A</span>
          <p className="auth-name">Agency OS</p>
        </div>
        {children}
      </div>
    </main>
  );
}
