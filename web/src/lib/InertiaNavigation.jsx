import { router, usePage } from "@inertiajs/react";
import { createPath, Router } from "react-router-dom";

const historyKey = "fish-port-navigation";
let pendingNavigation;

function visit(to, state, replace) {
  const href = typeof to === "string" ? to : createPath(to);
  const navigation = { href, state: state ?? null };
  pendingNavigation = navigation;

  router.visit(href, {
    replace,
    preserveScroll: true,
    preserveState: true,
    onSuccess: ({ url }) => router.remember({ ...navigation, href: url }, historyKey),
    onFinish: () => {
      if (pendingNavigation === navigation) pendingNavigation = undefined;
    },
  });
}

// Existing screens use React Router hooks. Inertia owns the actual visits and history.
const navigator = {
  createHref: (to) => typeof to === "string" ? to : createPath(to),
  go: (delta) => window.history.go(delta),
  push: (to, state) => visit(to, state, false),
  replace: (to, state) => visit(to, state, true),
};

export default function InertiaNavigation({ children }) {
  const { url } = usePage();
  const { pathname, search, hash } = new URL(url, window.location.origin);
  const rememberedNavigation = router.restore(historyKey);
  const state = pendingNavigation?.href === url ? pendingNavigation.state
    : rememberedNavigation?.href === url ? rememberedNavigation.state : null;

  return (
    <Router navigator={navigator} location={{ pathname, search, hash, state, key: url }}>
      {children}
    </Router>
  );
}
