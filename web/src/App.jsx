import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { Navigate, useLocation } from "react-router-dom";
import InertiaNavigation from "./lib/InertiaNavigation";
import BottomToast from "./components/BottomToast";
import FirstLoginCompletionModal from "./components/FirstLoginCompletionModal";
import LanguagePreferenceBridge from "./components/LanguagePreferenceBridge";
import PenaltyProgressToast from "./components/PenaltyProgressToast";
import { useSidebarStore } from "./store/sidebarStore";
import { clearStoredAuth, getDefaultRouteForUser, getStoredUser, hasAllowedWebRole, isAuthenticated } from "./pages/login/auth";

const RequireAuth = ({ children, allowedRoles }) => {
  const user = getStoredUser();
  const role = user?.role;

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const location = useLocation();
  const user = getStoredUser();
  const searchParams = new URLSearchParams(location.search);
  const freshLogin = searchParams.get("fresh") === "1";

  if (freshLogin) {
    clearStoredAuth();
    return children;
  }

  if (user && !hasAllowedWebRole(user)) {
    clearStoredAuth();
    return children;
  }

  if (!isAuthenticated()) {
    return children;
  }

  return <Navigate to={getDefaultRouteForUser(user)} replace />;
};

const staffRoles = ["head", "coordinator"];
const headRoles = ["head"];

function Screen({ children }) {
  const { access } = usePage().props;

  switch (access) {
    case "login":
      return <PublicOnlyRoute>{children}</PublicOnlyRoute>;
    case "staff":
      return <RequireAuth allowedRoles={staffRoles}>{children}</RequireAuth>;
    case "head":
      return <RequireAuth allowedRoles={headRoles}>{children}</RequireAuth>;
    default:
      return children;
  }
}

export default function App({ children }) {
  const syncSidebarViewport = useSidebarStore((state) => state.syncSidebarViewport);

  useEffect(() => {
    syncSidebarViewport();
    window.addEventListener("resize", syncSidebarViewport);
    return () => window.removeEventListener("resize", syncSidebarViewport);
  }, [syncSidebarViewport]);

  return (
    <InertiaNavigation>
      <LanguagePreferenceBridge />
      <Screen>{children}</Screen>
      <FirstLoginCompletionModal />
      <BottomToast />
      <PenaltyProgressToast />
    </InertiaNavigation>
  );
}
