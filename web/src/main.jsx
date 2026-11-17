import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';
import FishPortLayout from './App.jsx';
import ActivityLogsRealtimeBridge from './components/ActivityLogsRealtimeBridge.jsx';
import AccountStatusRealtimeBridge from './components/AccountStatusRealtimeBridge.jsx';
import DashboardRealtimeBridge from './components/DashboardRealtimeBridge.jsx';
import FeesRealtimeBridge from './components/FeesRealtimeBridge.jsx';
import NotificationsRealtimeBridge from './components/NotificationsRealtimeBridge.jsx';
import TransactionLockRealtimeBridge from './components/TransactionLockRealtimeBridge.jsx';
import TransactionsRealtimeBridge from './components/TransactionsRealtimeBridge.jsx';
import { queryClient } from './lib/queryClient';

const screens = import.meta.glob('./pages/**/*.jsx');

createInertiaApp({
  progress: false,
  async resolve(name) {
    const loadScreen = screens['./pages/' + name + '.jsx'];
    if (!loadScreen) throw new Error('Unknown Inertia page: ' + name);

    const { default: Screen } = await loadScreen();
    Screen.layout = (page) => <FishPortLayout>{page}</FishPortLayout>;
    return Screen;
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <QueryClientProvider client={queryClient}>
        <TransactionLockRealtimeBridge />
        <TransactionsRealtimeBridge />
        <DashboardRealtimeBridge />
        <FeesRealtimeBridge />
        <NotificationsRealtimeBridge />
        <ActivityLogsRealtimeBridge />
        <AccountStatusRealtimeBridge />
        <App {...props} />
      </QueryClientProvider>
    );
  },
});
