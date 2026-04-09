import React, { useEffect, useState } from 'react';
import { Grid, Layout } from 'antd';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const AppLayout = ({ children }) => {
  const screens = useBreakpoint();
  const isTabletOrMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(isTabletOrMobile);
  }, [isTabletOrMobile]);

  return (
    <Layout className="erp-app-layout" style={{ minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isTabletOrMobile={isTabletOrMobile}
      />
      <Layout className="erp-main-layout">
        <TopBar collapsed={collapsed} setCollapsed={setCollapsed} isTabletOrMobile={isTabletOrMobile} />
        <Content
          className="erp-app-content"
          style={{
            margin: isTabletOrMobile ? '8px' : '16px',
            padding: isTabletOrMobile ? 10 : 20,
            minHeight: 280,
            background: 'transparent',
            borderRadius: '8px',
            boxShadow: 'none',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
