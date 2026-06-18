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
          colorPrimary: '#f38b7a',
          fontFamily: "'Inter', sans-serif",
          borderRadius: 10,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f7f8fb',
        },
        components: {
          Menu: {
            itemSelectedBg: '#fff1ee',
            itemSelectedColor: '#d86d5b',
            itemHoverColor: '#d86d5b',
            itemHoverBg: '#fff8f6',
            groupTitleColor: '#9aa0a6',
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#595959',
            borderColor: '#f0f0f0',
          },
          Button: {
            primaryShadow: 'none',
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
    {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </React.StrictMode>,
)
