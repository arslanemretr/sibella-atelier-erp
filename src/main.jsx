import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App.jsx'
import './index.css'
import trTR from 'antd/locale/tr_TR';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

dayjs.locale('tr');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>,
)
