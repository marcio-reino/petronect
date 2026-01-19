"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/config/app.config";
import UserMenu from "../components/UserMenu";
import { ThemeProvider } from "../contexts/ThemeContext";
import QuickAccessTabs from "../components/QuickAccessTabs";

// Tipagem para itens de submenu
interface SubMenuItem {
  label: string;
  href: string;
}

// Tipagem para itens do menu principal
interface MenuItem {
  icon: string;
  label: string;
  href: string;
  submenu?: SubMenuItem[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fechar menu mobile ao mudar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const menuItems = APP_CONFIG.menu.items as MenuItem[];
  const isDashboardHome = pathname === '/dashboard';

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[#f9fafb] dark:bg-[#1a1a1a]">
          {/* Mobile Header */}
          {isMobile && (
            <header className="fixed top-0 left-0 right-0 h-16 bg-[#1a1a1a] dark:bg-[#222222] z-50 flex items-center justify-between px-4 shadow-lg">
              {/* Logo */}
              <div className="flex items-center">
                {APP_CONFIG.branding.sidebarLogo.type === "icon" ? (
                  <i className={`fas ${APP_CONFIG.branding.sidebarLogo.icon} text-2xl text-white`}></i>
                ) : (
                  <img
                    src={APP_CONFIG.branding.sidebarLogo.image}
                    alt="Logo"
                    className="w-10 h-10"
                  />
                )}
              </div>

              {/* Título central */}
              <div className="absolute left-1/2 transform -translate-x-1/2">
                <h1 className="text-white font-bold text-lg">{process.env.NEXT_PUBLIC_SYSTEM_NAME}</h1>
              </div>

              {/* Botão hambúrguer */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-10 h-10 flex items-center justify-center text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
              </button>
            </header>
          )}

          {/* Mobile Menu Overlay */}
          {isMobile && mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Mobile Menu Drawer */}
          {isMobile && (
            <aside
              className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-72 bg-[#1a1a1a] dark:bg-[#222222] z-50 transform transition-transform duration-300 ease-in-out shadow-2xl ${
                mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* User Info no topo do menu mobile */}
              <div className="p-4 border-b border-white/10">
                <UserMenu showNameOnMobile />
              </div>

              {/* Menu Items Mobile */}
              <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
                {menuItems.map((item, index) => {
                  const isActive = pathname === item.href;
                  const hasSubmenu = item.submenu && item.submenu.length > 0;
                  const isSubmenuOpen = openSubmenu === index;

                  return (
                    <div key={index}>
                      {hasSubmenu ? (
                        <button
                          onClick={() => setOpenSubmenu(isSubmenuOpen ? null : index)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200"
                          style={{
                            background: isSubmenuOpen ? APP_CONFIG.dashboard.sidebar.activeBackground : "transparent",
                            color: isSubmenuOpen ? APP_CONFIG.dashboard.sidebar.text : APP_CONFIG.dashboard.sidebar.textInactive,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <i className={`fas ${item.icon} text-lg w-5 text-center`}></i>
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <i className={`fas fa-chevron-${isSubmenuOpen ? "up" : "down"} text-xs`}></i>
                        </button>
                      ) : (
                        <a
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200"
                          style={{
                            background: isActive ? APP_CONFIG.dashboard.sidebar.activeBackground : "transparent",
                            color: isActive ? APP_CONFIG.dashboard.sidebar.text : APP_CONFIG.dashboard.sidebar.textInactive,
                          }}
                        >
                          <i className={`fas ${item.icon} text-lg w-5 text-center`}></i>
                          <span className="font-medium">{item.label}</span>
                        </a>
                      )}

                      {/* Submenu Mobile */}
                      {hasSubmenu && isSubmenuOpen && (
                        <div className="ml-6 mb-2">
                          {item.submenu?.map((subitem, subindex) => {
                            const isSubActive = pathname === subitem.href;
                            return (
                              <a
                                key={subindex}
                                href={subitem.href}
                                className="flex items-center py-2 px-3 rounded-lg mb-1 transition-all duration-200 text-sm"
                                style={{
                                  background: isSubActive ? APP_CONFIG.dashboard.sidebar.activeBackground : "transparent",
                                  color: isSubActive ? APP_CONFIG.dashboard.sidebar.text : "#4ade80",
                                }}
                              >
                                <span>{subitem.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* Versão no rodapé do menu mobile */}
              <div className="absolute bottom-4 left-0 right-0 px-4">
                <div className="text-center text-xs" style={{ color: APP_CONFIG.dashboard.sidebar.textInactive }}>
                  <p>Versão {APP_CONFIG.system.version}</p>
                  <p className="mt-1">© {APP_CONFIG.system.year} {APP_CONFIG.system.company}</p>
                </div>
              </div>
            </aside>
          )}

          {/* Sidebar Desktop */}
          <aside
            className={`fixed left-0 top-0 h-full text-white transition-all duration-300 z-40 shadow-2xl bg-[#1a1a1a] dark:bg-[#222222] hidden md:block ${
              sidebarExpanded ? "w-64" : "w-20"
            }`}
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
          >
            {/* Logo */}
            <div className="h-20 flex items-center justify-center border-b border-white/10 dark:border-[#444444] gap-3 px-4">
              {sidebarExpanded ? (
                // Logo completa quando expandido (mesma do login)
                APP_CONFIG.branding.loginLogo.type === "icon" ? (
                  <i
                    className={`fas ${APP_CONFIG.branding.loginLogo.icon} text-3xl`}
                  ></i>
                ) : (
                  <img
                    src={APP_CONFIG.branding.loginLogo.image}
                    alt="Logo"
                    className="h-10 w-auto max-w-[200px]"
                  />
                )
              ) : (
                // Ícone pequeno quando recolhido
                APP_CONFIG.branding.sidebarLogo.type === "icon" ? (
                  <i
                    className={`fas ${APP_CONFIG.branding.sidebarLogo.icon} text-3xl`}
                  ></i>
                ) : (
                  <img
                    src={APP_CONFIG.branding.sidebarLogo.image}
                    alt="Logo"
                    className="w-10 h-10 flex-shrink-0"
                  />
                )
              )}
            </div>

            {/* Menu Items */}
            <nav className="mt-6 px-3 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {menuItems.map((item, index) => {
                const isActive =
                  typeof window !== "undefined" &&
                  window.location.pathname === item.href;
                const hasSubmenu = item.submenu && item.submenu.length > 0;
                const isSubmenuOpen = openSubmenu === index;

                return (
                  <div key={index}>
                    {/* Menu Principal */}
                    {hasSubmenu ? (
                      <button
                        onClick={() =>
                          setOpenSubmenu(isSubmenuOpen ? null : index)
                        }
                        className={`w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg mb-2 transition-all duration-200`}
                        style={{
                          background: isSubmenuOpen
                            ? APP_CONFIG.dashboard.sidebar.activeBackground
                            : "transparent",
                          color: isSubmenuOpen
                            ? APP_CONFIG.dashboard.sidebar.text
                            : APP_CONFIG.dashboard.sidebar.textInactive,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSubmenuOpen) {
                            e.currentTarget.style.background =
                              APP_CONFIG.dashboard.sidebar.hoverBackground;
                            e.currentTarget.style.color =
                              APP_CONFIG.dashboard.sidebar.text;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSubmenuOpen) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color =
                              APP_CONFIG.dashboard.sidebar.textInactive;
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <i
                            className={`fas ${item.icon} text-lg w-5 text-center`}
                          ></i>
                          {sidebarExpanded && (
                            <span className="font-medium">{item.label}</span>
                          )}
                        </div>
                        {sidebarExpanded && (
                          <i
                            className={`fas fa-chevron-${isSubmenuOpen ? "up" : "down"} text-xs`}
                          ></i>
                        )}
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        className={`flex items-center gap-4 px-4 py-3 rounded-lg mb-2 transition-all duration-200`}
                        style={{
                          background: isActive
                            ? APP_CONFIG.dashboard.sidebar.activeBackground
                            : "transparent",
                          color: isActive
                            ? APP_CONFIG.dashboard.sidebar.text
                            : APP_CONFIG.dashboard.sidebar.textInactive,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background =
                              APP_CONFIG.dashboard.sidebar.hoverBackground;
                            e.currentTarget.style.color =
                              APP_CONFIG.dashboard.sidebar.text;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color =
                              APP_CONFIG.dashboard.sidebar.textInactive;
                          }
                        }}
                      >
                        <i
                          className={`fas ${item.icon} text-lg w-5 text-center`}
                        ></i>
                        {sidebarExpanded && (
                          <span className="font-medium">{item.label}</span>
                        )}
                      </a>
                    )}

                    {/* Submenu */}
                    {hasSubmenu && isSubmenuOpen && sidebarExpanded && (
                      <div className="ml-6 mb-2">
                        {item.submenu?.map((subitem, subindex) => {
                          const isSubActive =
                            typeof window !== "undefined" &&
                            window.location.pathname === subitem.href;

                          return (
                            <a
                              key={subindex}
                              href={subitem.href}
                              className={`flex items-center py-2 px-3 rounded-lg mb-1 transition-all duration-200 text-sm`}
                              style={{
                                background: isSubActive
                                  ? APP_CONFIG.dashboard.sidebar
                                      .activeBackground
                                  : "transparent",
                                color: isSubActive
                                  ? APP_CONFIG.dashboard.sidebar.text
                                  : "#4ade80",
                              }}
                              onMouseEnter={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.background =
                                    APP_CONFIG.dashboard.sidebar.hoverBackground;
                                  e.currentTarget.style.color =
                                    APP_CONFIG.dashboard.sidebar.text;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.background =
                                    "transparent";
                                  e.currentTarget.style.color =
                                    "#4ade80";
                                }
                              }}
                            >
                              <span>{subitem.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Versão */}
            <div className="absolute bottom-4 left-0 right-0 px-3">
              {sidebarExpanded ? (
                <div
                  className="text-center text-xs"
                  style={{ color: APP_CONFIG.dashboard.sidebar.textInactive }}
                >
                  <p>Versão {APP_CONFIG.system.version}</p>
                  <p className="mt-1">
                    © {APP_CONFIG.system.year} {APP_CONFIG.system.company}
                  </p>
                </div>
              ) : (
                <div
                  className="text-center text-xs"
                  style={{ color: APP_CONFIG.dashboard.sidebar.textInactive }}
                >
                  <p>
                    v{APP_CONFIG.system.version.split(".")[0]}.
                    {APP_CONFIG.system.version.split(".")[1]}
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <div className="md:ml-20">
            {/* Top Bar - Desktop only */}
            <header className="fixed top-0 right-0 left-0 md:left-20 z-30 bg-white dark:bg-[#2a2a2a] border-b border-gray-100 dark:border-[#444444] hidden md:block">
              {/* Barra superior com título e menu */}
              <div className="h-20 flex items-center justify-between px-8">
                {/* Título */}
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">
                    {process.env.NEXT_PUBLIC_SYSTEM_NAME}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-[#aaaaaa] mt-1">
                    {APP_CONFIG.messages.dashboard.subtitle}
                  </p>
                </div>

                {/* User Menu */}
                <UserMenu />
              </div>

              {/* Quick Access Tabs - Exibe em todas as rotas exceto /dashboard */}
              {!isDashboardHome && (
                <div className="bg-gray-50 dark:bg-[#333333] border-t border-gray-100 dark:border-[#444444] pt-2">
                  <QuickAccessTabs />
                </div>
              )}
            </header>

            {/* Page Content */}
            <main className={`p-4 md:p-8 pt-20 ${isDashboardHome ? 'md:pt-28' : 'md:pt-[9.25rem]'}`}>{children}</main>
          </div>
        </div>
    </ThemeProvider>
  );
}
