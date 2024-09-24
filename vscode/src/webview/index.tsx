import React from "react";
import { createRoot } from "react-dom/client";

// Component import
import App from "./components/App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
