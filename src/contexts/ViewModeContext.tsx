import { createContext, useContext, ReactNode } from "react";

type ViewMode = "default";

interface ViewModeContextType {
  viewMode: ViewMode;
  isSimulatingEmployee: boolean;
  setViewMode: (mode: ViewMode) => void;
  toggleEmployeeView: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  return (
    <ViewModeContext.Provider value={{
      viewMode: "default",
      isSimulatingEmployee: false,
      setViewMode: () => {},
      toggleEmployeeView: () => {},
    }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
