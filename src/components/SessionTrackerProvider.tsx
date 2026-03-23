import { useSessionTracker } from "@/hooks/useSessionTracker";

export function SessionTrackerProvider({ children }: { children: React.ReactNode }) {
  useSessionTracker();
  return <>{children}</>;
}
