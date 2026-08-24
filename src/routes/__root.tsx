import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ShieldCheck, Clock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePerfil } from '@/hooks/use-perfil';
import { useTheme } from '@/hooks/use-theme';
import appCss from "../styles.css?url";
import { useEffect, useState } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Timesheet-APP" },
      { name: "description", content: "Time Keeper Pro is a PWA timesheet app for engineering consultants to track hours by contract and activity." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Timesheet-APP" },
      { property: "og:description", content: "Time Keeper Pro is a PWA timesheet app for engineering consultants to track hours by contract and activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Timesheet-APP" },
      { name: "twitter:description", content: "Time Keeper Pro is a PWA timesheet app for engineering consultants to track hours by contract and activity." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ca8KgszkgWXOJPwcpuNFQdM49A33/social-images/social-1779581905364-375289-tempo-e-dinheiro-gratis-vetor-removebg-preview.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ca8KgszkgWXOJPwcpuNFQdM49A33/social-images/social-1779581905364-375289-tempo-e-dinheiro-gratis-vetor-removebg-preview.webp" },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { isAdmin, isAuthenticated, loading } = usePerfil();
  useTheme();
  
  // 🌟 NOVO: Controla a barra principal retrátil
  const [isMainSidebarOpen, setIsMainSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-muted-foreground bg-background">
        Carregando chaves de acesso...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <main className="w-full min-h-screen bg-background">
          <Outlet />
        </main>
      ) : (
        <div className="flex h-screen w-full overflow-hidden bg-background">
          
          {/* MENU LATERAL - Renderizado APENAS se o usuário for Admin */}
          {isAdmin && (
            <aside className={`border-r bg-card flex flex-col shrink-0 overflow-y-auto transition-all duration-300 ${isMainSidebarOpen ? 'w-64 p-4 gap-4' : 'w-18 py-4 px-2 gap-6 items-center'}`}>
              <div className={`font-bold text-xl mb-4 text-primary flex items-center select-none ${isMainSidebarOpen ? 'gap-2 px-3 w-full justify-between' : 'justify-center w-full'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src="/favicon.ico" alt="Logo Engeprice" className="w-7 h-7 object-contain transition-colors dark:bg-white dark:p-1 dark:rounded-md shrink-0" />
                  {isMainSidebarOpen && <span className="truncate">Engeprice</span>}
                </div>
                <button onClick={() => setIsMainSidebarOpen(!isMainSidebarOpen)} className="text-muted-foreground hover:text-primary shrink-0">
                  {isMainSidebarOpen ? <PanelLeftClose className="w-5 h-5"/> : <PanelLeftOpen className="w-5 h-5"/>}
                </button>
              </div>
              
              <Link to="/" className={`flex items-center rounded-md hover:bg-muted transition-colors [&.active]:bg-primary/10 [&.active]:text-primary ${isMainSidebarOpen ? 'p-3 gap-2 w-full' : 'justify-center w-12 h-12 shrink-0'}`} title={!isMainSidebarOpen ? "Meu Timesheet" : ""}>
                <Clock className="w-5 h-5 shrink-0" />
                {isMainSidebarOpen && <span className="truncate">Meu Timesheet</span>}
              </Link>

              <Link to="/admin" className={`flex items-center rounded-md hover:bg-primary/10 text-primary/80 hover:text-primary transition-colors [&.active]:bg-primary [&.active]:text-primary-foreground mt-auto ${isMainSidebarOpen ? 'p-3 gap-2 w-full' : 'justify-center w-12 h-12 shrink-0'}`} title={!isMainSidebarOpen ? "Central de Comando" : ""}>
                <ShieldCheck className="w-5 h-5 shrink-0" />
                {isMainSidebarOpen && <span className="truncate">Central de Comando</span>}
              </Link>
            </aside>
          )}

          <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-background">
            <Outlet />
          </main>
        </div>
      )}
    </QueryClientProvider>
  );
}