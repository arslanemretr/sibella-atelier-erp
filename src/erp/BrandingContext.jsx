import React from "react";
import { ConfigProvider } from "antd";
import { getBrandingFresh, DEFAULT_BRANDING } from "./brandingData";
import defaultLogoSrc from "../assets/logo.png";
import defaultMobileLogoSrc from "../assets/logo-mobile.png";

const BrandingContext = React.createContext({
  ...DEFAULT_BRANDING,
  logoSrc: defaultLogoSrc,
  mobileLogoSrc: defaultMobileLogoSrc,
  refreshBranding: () => {},
});

export function useBranding() {
  return React.useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = React.useState(DEFAULT_BRANDING);

  const refreshBranding = React.useCallback(() => {
    getBrandingFresh().then(setBranding).catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  const logoSrc = branding.logoUrl || defaultLogoSrc;
  const mobileLogoSrc = branding.mobileLogoUrl || defaultMobileLogoSrc;

  const contextValue = React.useMemo(() => ({
    ...branding,
    logoSrc,
    mobileLogoSrc,
    refreshBranding,
  }), [branding, logoSrc, mobileLogoSrc, refreshBranding]);

  return (
    <BrandingContext.Provider value={contextValue}>
      <ConfigProvider theme={{ token: { colorPrimary: branding.primaryColor } }}>
        {children}
      </ConfigProvider>
    </BrandingContext.Provider>
  );
}
