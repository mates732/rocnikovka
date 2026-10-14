import { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content" aria-live="polite">
          {children}
        </main>
      </div>
    </div>
  );
}
