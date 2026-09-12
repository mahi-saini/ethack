import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DatasetProvider } from "./dataset";
import Shell from "./components/Shell";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import CompanyPage from "./pages/Company";
import Rankings from "./pages/Rankings";
import Compare from "./pages/Compare";
import Studio from "./pages/Studio";
import Advisor from "./pages/Advisor";
import Method from "./pages/Method";

export default function App() {
  return (
    <DatasetProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/company/:ticker" element={<CompanyPage />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/advisor" element={<Advisor />} />
            <Route path="/calculator" element={<Navigate to="/advisor" replace />} />
            <Route path="/method" element={<Method />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DatasetProvider>
  );
}
