/**
 * Institucional page animations
 * – Hero parallax
 * – Scroll-reveal (cards, quote, badges)
 * – Image zoom-in on viewport entry
 * – Animated decorative line
 */

export function initClubAnimations() {
  /* ── Hero parallax ── */
  const heroImg = document.querySelector<HTMLElement>("[data-club-hero-img]");
  if (heroImg) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        // Only apply parallax while hero is visible
        if (scrollY < window.innerHeight * 1.2) {
          heroImg.style.transform = `translateY(${scrollY * 0.3}px) scale(1.1)`;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial position
    heroImg.style.transform = "translateY(0) scale(1.1)";
  }

  /* ── Scroll reveal ── */
  const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (revealEls.length > 0) {
    // Set initial state
    revealEls.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(40px)";
      el.style.transition = "opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)";
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const delay = parseInt(el.dataset.revealDelay ?? "0", 10);
          setTimeout(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }, delay);
          revealObserver.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ── Image zoom on viewport ── */
  const zoomEls = document.querySelectorAll<HTMLElement>("[data-zoom-in]");
  if (zoomEls.length > 0) {
    zoomEls.forEach((el) => {
      el.style.transform = "scale(1)";
      el.style.transition = "transform 1.2s cubic-bezier(0.22,1,0.36,1)";
    });

    const zoomObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.style.transform = "scale(1.08)";
          zoomObserver.unobserve(el);
        });
      },
      { threshold: 0.2 },
    );

    zoomEls.forEach((el) => zoomObserver.observe(el));
  }

  /* ── Decorative line grow ── */
  const lines = document.querySelectorAll<HTMLElement>("[data-line-grow]");
  if (lines.length > 0) {
    lines.forEach((el) => {
      el.style.transform = "scaleX(0)";
      el.style.transformOrigin = "left";
      el.style.transition = "transform 1s cubic-bezier(0.22,1,0.36,1) 0.4s";
    });

    const lineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).style.transform = "scaleX(1)";
          lineObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.5 },
    );

    lines.forEach((el) => lineObserver.observe(el));
  }

  /* ── Quote border grow ── */
  const quoteBorders = document.querySelectorAll<HTMLElement>("[data-border-grow]");
  if (quoteBorders.length > 0) {
    quoteBorders.forEach((el) => {
      el.style.setProperty("--border-scale", "0");
    });

    const borderObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).style.setProperty("--border-scale", "1");
          borderObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.3 },
    );

    quoteBorders.forEach((el) => borderObserver.observe(el));
  }
}
