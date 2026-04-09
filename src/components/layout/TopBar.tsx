import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: "Home", path: "/", exact: true },
  { label: "Services", path: "/services" },
  { label: "Sponsors", path: "/sponsors" },
  { label: "Work With Us", path: "/intake" },
];

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function TopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (mobileMenuRef.current?.contains(target) || toggleButtonRef.current?.contains(target)) {
        return;
      }

      setMobileOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go to PEC Nexus homepage"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="font-display text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="truncate font-display text-xl font-bold text-foreground">PEC Nexus</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = isNavItemActive(activePath, item);

            return (
              <Button
                key={item.path}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                <Link to={item.path} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              </Button>
            );
          })}

          <Button asChild size="sm" className="ml-2">
            <Link to="/login">Sign In</Link>
          </Button>
        </nav>

        <Button
          ref={toggleButtonRef}
          variant="ghost"
          size="icon"
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation-menu" ref={mobileMenuRef} className="border-t bg-card p-4 md:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const active = isNavItemActive(activePath, item);

              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={cn("w-full justify-start", active && "bg-muted text-foreground")}
                >
                  <Link to={item.path} aria-current={active ? "page" : undefined}>
                    {item.label}
                  </Link>
                </Button>
              );
            })}

            <Button asChild className="w-full">
              <Link to="/login">Sign In</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
