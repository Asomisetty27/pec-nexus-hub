import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Services", path: "/services" },
  { label: "Sponsors", path: "/sponsors" },
  { label: "Work With Us", path: "/intake" },
];

export function TopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="font-display text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-display text-xl font-bold text-foreground">PEC Nexus</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  location.pathname === item.path && "text-foreground bg-muted"
                )}
              >
                {item.label}
              </Button>
            </Link>
          ))}
          <Link to="/login">
            <Button size="sm" className="ml-2">Sign In</Button>
          </Link>
        </nav>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t bg-card p-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{item.label}</Button>
              </Link>
            ))}
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Sign In</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
