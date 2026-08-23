import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll window (and common app shells) to top on every route change. */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll('.blox-shell-main, .blox-shell__main').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname, search]);

  return null;
}
