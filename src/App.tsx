import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import SilenceRemover from "./pages/SilenceRemover";
import Subtitle from "./pages/Subtitle";
import Game from "./pages/Game";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="silence" element={<SilenceRemover />} />
          <Route path="subtitle" element={<Subtitle />} />
          <Route path="game" element={<Game />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
