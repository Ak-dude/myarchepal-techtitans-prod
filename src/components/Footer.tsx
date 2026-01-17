/**
 * Footer Component
 *
 * Standard footer for ArchePal.
 * Displays at the bottom of all pages.
 */

import { Link } from "react-router-dom";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>&copy; {currentYear} ArchePal. All rights reserved.</span>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/feedback-results"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Testimonials
          </Link>
        </div>
      </div>
    </footer>
  );
};
