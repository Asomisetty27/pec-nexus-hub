import { Link, Outlet } from "react-router-dom";

import { TopBar } from "./TopBar";

const QUICK_LINKS = [
  { label: "Services", to: "/services" },
  { label: "Sponsors", to: "/sponsors" },
  { label: "Work With Us", to: "/intake" },
  { label: "Apply to Join", to: "/apply" },
] as const;

export function PublicLayout() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar />

      <main id="public-main-content" className="flex-1" role="main">
        <Outlet />
      </main>

      <footer className="border-t bg-primary text-primary-foreground" aria-labelledby="public-footer-heading">
        <div className="container py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <section className="max-w-sm">
              <h2 id="public-footer-heading" className="font-display text-lg font-bold">
                PEC Nexus
              </h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground/80">
                Poly-Engineering Consulting at Cal Poly SLO. Student-run engineering consulting.
              </p>
            </section>

            <nav aria-label="Footer quick links">
              <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-primary-foreground/70">
                Quick Links
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
                {QUICK_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <section aria-labelledby="footer-contact-heading">
              <h3
                id="footer-contact-heading"
                className="font-sans text-sm font-semibold uppercase tracking-wider text-primary-foreground/70"
              >
                Contact
              </h3>
              <div className="mt-3 space-y-1 text-sm text-primary-foreground/80">
                <a
                  href="mailto:calpoly.pec@gmail.com"
                  className="block transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                >
                  calpoly.pec@gmail.com
                </a>
                <p>Cal Poly, San Luis Obispo, CA</p>
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-primary-foreground/20 pt-6 text-center text-xs text-primary-foreground/60">
            © {currentYear} Poly-Engineering Consulting. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
