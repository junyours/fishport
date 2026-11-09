// Browser-only fixture: render the actual Settings screen with isolated demo
// accounts and an in-memory API adapter. No request reaches the real backend.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Settings from "../../src/pages/rbac/settings";
import LanguagePreferenceBridge from "../../src/components/LanguagePreferenceBridge";
import BottomToast from "../../src/components/BottomToast";
import api from "../../src/api/axios";
import { useLanguageStore } from "../../src/store/languageStore";
import "../../src/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const user = () => JSON.parse(sessionStorage.getItem("user") || "null");
api.defaults.adapter = async (config) => ({
  config, status: 200, statusText: "OK", headers: {},
  data: config.url === "/me" ? { user: user() }
    : config.url?.includes("notifications") ? { data: [], notifications: [], unreadCount: 0, total: 0 }
      : { data: [], transaction_lock: null },
});
if (user()) client.setQueryData(["settings-data"], { user: user() });

function DemoLogin() {
  const navigate = useNavigate();
  const login = (suffix, user_id) => {
    const profile = { user_id, first_name: "Demo", last_name: `Account ${suffix}`, email: `demo-${suffix.toLowerCase()}@example.test`, role: "head", gender: "male", address: "Opol", birthday: "1990-01-01", contact_number: "", email_verified_at: "2026-01-01" };
    sessionStorage.setItem("user", JSON.stringify(profile));
    sessionStorage.setItem("token", "isolated-language-fixture");
    client.setQueryData(["settings-data"], { user: profile });
    useLanguageStore.getState().loadLanguage();
    navigate("/settings");
  };
  return <main className="mx-auto max-w-lg space-y-5 p-10">
    <h1 className="text-lg font-bold">Language preference browser check</h1>
    <p>Demo accounts only. The real backend is disconnected.</p>
    <button className="mr-3 rounded-xl bg-slate-900 px-5 py-3 text-white" onClick={() => login("A", 900001)}>Sign in Account A</button>
    <button className="rounded-xl bg-slate-900 px-5 py-3 text-white" onClick={() => login("B", 900002)}>Sign in Account B</button>
  </main>;
}

const root = import.meta.hot?.data.root || createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[user() ? "/settings" : "/login"]}>
  <LanguagePreferenceBridge />
  <Routes>
    <Route path="/settings" element={<Settings />} />
    <Route path="/login" element={<DemoLogin />} />
    <Route path="*" element={<Navigate replace to={user() ? "/settings" : "/login"} />} />
  </Routes>
  <BottomToast />
</MemoryRouter></QueryClientProvider>);
