/**
 * ============================================
 * CONFIGURACAO GERAL DO FRONTEND
 * Sistema Modelo
 * ============================================
 *
 * Este arquivo centraliza todas as configuracoes visuais
 * e de branding do sistema. Altere aqui para personalizar
 * cores, logos, textos e outros elementos visuais.
 */

export const APP_CONFIG = {
  // ============================================
  // INFORMACOES DO SISTEMA
  // ============================================
  system: {
    name: 'Sistema Modelo',
    fullName: 'Sistema Modelo - Base para Novos Projetos',
    version: '1.0.0',
    year: 2025,
    company: 'Sua Empresa',
  },

  // ============================================
  // LOGOS E ICONES
  // ============================================
  branding: {
    // Logo do Login (caminho da imagem ou icone Font Awesome)
    loginLogo: {
      type: 'image', // 'icon' ou 'image'
      // Se type='icon': classe do Font Awesome
      icon: 'fa-cubes',
      // Se type='image': caminho da imagem
      image: '/logo.svg',
    },

    // Logo do Menu Lateral
    sidebarLogo: {
      type: 'image', // 'icon' ou 'image'
      icon: 'fa-cubes',
      image: '/images/logo-ico.svg',
    },

    // Favicon (icone do navegador)
    favicon: '/favicon.svg',
  },

  // ============================================
  // CORES - PAGINA DE LOGIN
  // ============================================
  login: {
    // Background gradiente (2 cores)
    background: {
      from: '#3b82f6', // Cor inicial do gradiente (azul)
      to: '#1d4ed8', // Cor final do gradiente
      direction: '135deg', // Direcao do gradiente
    },

    // Card de login
    card: {
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '1rem',
    },

    // Icone do logo
    logoIcon: {
      background: {
        from: '#3b82f6',
        to: '#1d4ed8',
      },
      color: '#3b82f6',
    },

    // Botao de login
    button: {
      background: {
        from: '#3b82f6',
        to: '#1d4ed8',
      },
      hoverShadow: 'rgba(59, 130, 246, 0.3)',
      text: '#ffffff',
    },

    // Links e textos
    link: {
      color: '#3b82f6',
      hoverColor: '#1d4ed8',
    },
  },

  // ============================================
  // CORES - DASHBOARD
  // ============================================
  dashboard: {
    // Menu Lateral (Sidebar)
    sidebar: {
      background: {
        from: '#3b82f6',
        to: '#1d4ed8',
      },
      text: '#ffffff',
      textInactive: 'rgba(255, 255, 255, 0.7)',
      activeBackground: 'rgba(255, 255, 255, 0.2)',
      hoverBackground: 'rgba(255, 255, 255, 0.1)',
      border: 'rgba(255, 255, 255, 0.1)',
    },

    // Barra Superior (Top Bar)
    topbar: {
      background: '#ffffff',
      border: '#e5e7eb',
      shadow: true,
    },

    // Avatar/Icone do Usuario
    userAvatar: {
      background: {
        from: '#3b82f6',
        to: '#1d4ed8',
      },
      text: '#ffffff',
      borderRadius: '9999px',
    },

    // Menu dropdown do usuario
    userMenu: {
      background: '#ffffff',
      border: '#e5e7eb',
      shadow: true,
      hoverBackground: '#f9fafb',
    },

    // Pagina principal
    mainContent: {
      background: '#f9fafb',
    },
  },

  // ============================================
  // CORES - WIDGETS E CARDS
  // ============================================
  widgets: {
    // Cards de metricas
    card: {
      background: '#ffffff',
      border: '#e5e7eb',
      shadow: true,
      borderRadius: '0.75rem',
    },

    // Cores dos indicadores
    colors: {
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      primary: '#3b82f6',
      secondary: '#1d4ed8',
    },
  },

  // ============================================
  // TEXTOS E MENSAGENS
  // ============================================
  messages: {
    login: {
      title: 'Bem-vindo!',
      subtitle: 'Entre com suas credenciais para continuar',
      emailLabel: 'Email',
      emailPlaceholder: 'seu@email.com',
      passwordLabel: 'Senha',
      passwordPlaceholder: '********',
      rememberMe: 'Continuar logado',
      forgotPassword: 'Esqueci minha senha',
      loginButton: 'Entrar',
      noAccount: 'Nao tem uma conta?',
      contactLink: 'Entre em contato',
    },

    dashboard: {
      welcome: 'Sistema Modelo',
      subtitle: 'Painel de Controle',
    },

    userMenu: {
      profile: 'Meu Perfil',
      settings: 'Configuracoes',
      logout: 'Sair',
    },
  },

  // ============================================
  // MENU LATERAL - ITENS
  // ============================================
  menu: {
    items: [
      { icon: 'fa-home', label: 'Dashboard', href: '/dashboard' },
      { icon: 'fa-file-alt', label: 'Oportunidades', href: '/dashboard/oportunidades/list' },
      { icon: 'fa-robot', label: 'Agentes', href: '/dashboard/robos/list' },
      { icon: 'fa-users', label: 'Usuarios', href: '/dashboard/users/list' },
      { icon: 'fa-user-shield', label: 'Grupos de Acesso', href: '/dashboard/roles/list' },
      { icon: 'fa-history', label: 'Logs do Sistema', href: '/dashboard/logs/system' },
    ],
  },

  // ============================================
  // API E INTEGRACOES
  // ============================================
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    timeout: 30000,
  },

  // ============================================
  // RECURSOS E FUNCIONALIDADES
  // ============================================
  features: {
    rememberMe: true,
    forgotPassword: true,
    darkMode: true,
    notifications: true,
    multiLanguage: false,
  },
}

// Helper: Gerar CSS de gradiente a partir da config
export const getGradientCSS = (gradient: {
  from: string
  to: string
  direction?: string
}) => {
  const dir = gradient.direction || '135deg'
  return `linear-gradient(${dir}, ${gradient.from} 0%, ${gradient.to} 100%)`
}

// Helper: Gerar style object para background gradiente
export const getGradientStyle = (gradient: { from: string; to: string; direction?: string }) => {
  return {
    background: getGradientCSS(gradient),
  }
}

export default APP_CONFIG
