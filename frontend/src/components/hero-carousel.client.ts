/**
 * Carrusel del hero (DOM de `Hero.astro`).
 */
export function initHeroCarousel(): void {
  const root = document.querySelector("[data-hero]");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll("[data-hero-slide]"));
  const prevBtn = root.querySelector("[data-hero-prev]");
  const nextBtn = root.querySelector("[data-hero-next]");

  if (slides.length < 2 || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let intervalId = 0;
  const intervalMs = 8000;

  const render = () => {
    slides.forEach((slide, index) => {
      const active = index === currentIndex;
      slide.classList.toggle("opacity-100", active);
      slide.classList.toggle("opacity-0", !active);
      slide.classList.toggle("pointer-events-none", !active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });
  };

  const goTo = (nextIndex: number) => {
    currentIndex = (nextIndex + slides.length) % slides.length;
    render();
  };

  const restartAuto = () => {
    window.clearInterval(intervalId);
    intervalId = window.setInterval(() => {
      goTo(currentIndex + 1);
    }, intervalMs);
  };

  prevBtn.addEventListener("click", () => {
    goTo(currentIndex - 1);
    restartAuto();
  });

  nextBtn.addEventListener("click", () => {
    goTo(currentIndex + 1);
    restartAuto();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearInterval(intervalId);
      return;
    }
    restartAuto();
  });

  restartAuto();
}
