import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-primary text-primary-foreground">
        <div className="container py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-display text-lg font-bold">PEC Nexus</h3>
              <p className="mt-2 text-sm opacity-80">
                Poly-Engineering Consulting at Cal Poly SLO. Student-run engineering consulting.
              </p>
            </div>
            <div>
              <h4 className="font-sans text-sm font-semibold uppercase tracking-wider opacity-70">Quick Links</h4>
              <ul className="mt-3 space-y-2 text-sm opacity-80">
                <li><a href="/services" className="hover:opacity-100">Services</a></li>
                <li><a href="/sponsors" className="hover:opacity-100">Sponsors</a></li>
                <li><a href="/intake" className="hover:opacity-100">Work With Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-sans text-sm font-semibold uppercase tracking-wider opacity-70">Contact</h4>
              <p className="mt-3 text-sm opacity-80">pec@calpoly.edu</p>
              <p className="text-sm opacity-80">Cal Poly, San Luis Obispo, CA</p>
            </div>
          </div>
          <div className="mt-8 border-t border-primary-foreground/20 pt-6 text-center text-xs opacity-60">
            © {new Date().getFullYear()} Poly-Engineering Consulting. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
