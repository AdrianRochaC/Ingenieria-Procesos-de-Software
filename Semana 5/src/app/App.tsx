import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { UploadPage } from "./pages/UploadPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/project/:id/manage" element={<ProjectDetailPage />} />
            <Route path="/project/:id" element={<ProjectDetailPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                borderRadius: "16px",
                fontFamily: "inherit",
                fontSize: "14px",
                padding: "12px 18px",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
