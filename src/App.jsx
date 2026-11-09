import { createRoot } from "react-dom/client";
import Shell from "./components/Shell.jsx";
import { ToastViewport } from "./components/Toast.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <>
    <Shell />
    <ToastViewport />
  </>,
);
