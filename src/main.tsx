import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPwa } from "./pwa";

void setupPwa();

createRoot(document.getElementById("root")!).render(<App />);
