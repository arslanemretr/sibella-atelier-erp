import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.jsx'
import './index.css'
import trTR from 'antd/locale/tr_TR';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

dayjs.locale('tr');

// TanStack Query — guardrail'ler: makul staleTime, pencere odaginda otomatik
// yeniden cekme kapali, tek retry. (Pilot: Operasyon Merkezi)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
    <ConfigProvider
      locale={trTR}
      theme={{
        token: {
          // Daha belirgin coral aksan + sicak ivory zemin
          colorPrimary: '#e8674e',
          colorInfo: '#e8674e',
          fontFamily: "'Inter', sans-serif",
          borderRadius: 12,
          borderRadiusLG: 14,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#ffffff',
          colorBorderSecondary: '#eceef2',
        },
        components: {
          Menu: {
            itemSelectedBg: '#fbeee8',
            itemSelectedColor: '#c75b40',
            itemHoverColor: '#c75b40',
            itemHoverBg: '#fbf6f3',
            groupTitleColor: '#9aa0a6',
          },
          Table: {
            headerBg: '#f7f8fa',
            headerColor: '#5f6570',
            borderColor: '#eef0f3',
            rowHoverBg: '#f7f8fa',
          },
          Button: {
            primaryShadow: 'none',
            fontWeight: 500,
          },
          Card: {
            borderRadiusLG: 14,
          },
          Layout: {
            siderBg: '#ffffff',
            headerBg: '#ffffff',
            bodyBg: '#ffffff',
          },
        }
      }}
    >
      <App />
    </ConfigProvider>
    {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </React.StrictMode>,
)
