import { expect, test } from "@playwright/test";
import { buildLastSevenDaysOptions } from "../src/utils/replay-date-options";

const widths = [375, 768, 1024, 1279, 1280, 1440, 1920];
const routes = ["/", "/deportes/futbol-infantil", "/deportes/natacion-jubilados", "/espacios/quincho", "/noticias", "/contacto", "/replays"];

test("las fechas de replays siguen el dÃ­a argentino al cruzar medianoche UTC", () => {
  const dates = buildLastSevenDaysOptions(new Date("2026-09-24T00:01:00Z"));
  expect(dates[0]).toEqual({ value: "2026-09-23", label: "Hoy â€” miÃ©, 23/09/2026" });
  expect(dates[6].value).toBe("2026-09-17");
});

for (const width of widths) {
  test(`pÃ¡ginas pÃºblicas y navegaciÃ³n a ${width}px`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("main, #home-hero").first()).toBeVisible();
      if (route === "/deportes/natacion-jubilados") {
        await expect(page.getByRole("heading", { level: 1 })).toContainText("NATACIÃ“N JUBILADOS");
        await expect(page.getByRole("heading", { level: 2, name: /Horarios/i })).toBeVisible();
      }
      if (route === "/replays") {
        await expect(page.getByLabel("Cancha")).toBeVisible();
        await expect(page.getByLabel("DÃ­a")).toBeVisible();
        await expect(page.getByRole("button", { name: /COMPRAR REPLAY/ })).toBeDisabled();
      }
      // scrollWidth on elements exposes clipping masked by overflow-x: hidden on html/body.
      const offscreen = await page.locator("main *").evaluateAll((elements) => elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.position !== "absolute" && style.position !== "fixed" && rect.width > 0 && rect.left < -2;
        }).slice(0, 3).map((element) => element.tagName));
      expect(offscreen, `${route} @ ${width}: elements past left viewport`).toEqual([]);
    }
    await page.goto("/");
    const clippedHeaderLinks = await page.locator("header[data-mobile-nav] nav > ul a").evaluateAll((links) => links
      .filter((link) => link.getClientRects().length > 0 && link.getBoundingClientRect().right > window.innerWidth + 1)
      .map((link) => link.textContent?.trim()));
    expect(clippedHeaderLinks, `enlaces cortados en header @ ${width}px`).toEqual([]);
    if (width < 1280) {
      const toggle = page.locator("[data-mobile-menu-toggle]");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const mobileMenu = page.locator("[data-mobile-menu-panel]");
      await mobileMenu.locator("summary").filter({ hasText: "Pileta" }).first().click();
      await expect(mobileMenu.getByRole("link", { name: "NataciÃ³n Jubilados" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } else {
      const dropdown = page.getByRole("button", { name: "Deportes", exact: true }).first();
      await dropdown.focus();
      await expect(dropdown).toHaveAttribute("aria-expanded", "true");
      const menu = page.locator(`#${await dropdown.getAttribute("aria-controls")}`);
      const rect = await menu.boundingBox();
      expect(rect, "dropdown visible").not.toBeNull();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      await expect(dropdown).toHaveAttribute("aria-expanded", "false");
      const pileta = page.getByRole("button", { name: "Pileta", exact: true }).first();
      await pileta.focus();
      await expect(pileta).toHaveAttribute("aria-expanded", "true");
      const club = page.getByRole("button", { name: "Club", exact: true }).first();
      await club.focus();
      const sedes = page.getByRole("button", { name: "Sedes", exact: true }).first();
      await sedes.focus();
      await expect(sedes).toHaveAttribute("aria-expanded", "true");
      const submenu = page.locator(`#${await sedes.getAttribute("aria-controls")}`);
      const subRect = await submenu.boundingBox();
      expect(subRect, "submenu Sedes visible").not.toBeNull();
      expect(subRect!.x).toBeGreaterThanOrEqual(0);
      expect(subRect!.x + subRect!.width).toBeLessThanOrEqual(width);
      for (const label of ["Deportes", "Pileta", "Alquileres", "Club", "Socios"]) {
        const trigger = page.getByRole("button", { name: label, exact: true }).first();
        await trigger.focus();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
        const box = await panel.boundingBox();
        expect(box, `${label} @ ${width}px`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
    expect(pageErrors, `errores JS @ ${width}px`).toEqual([]);
  });
}

test("teclado en los dos lados del breakpoint del header", async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 900 });
  await page.goto("/");
  const toggle = page.locator("[data-mobile-menu-toggle]");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("[data-mobile-menu-panel]");
  const pileta = panel.locator("summary").filter({ hasText: "Pileta" }).first();
  await pileta.focus();
  await page.keyboard.press("Space");
  await expect(panel.getByRole("link", { name: "NataciÃ³n NiÃ±os" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1280, height: 900 });
  const deportes = page.getByRole("button", { name: "Deportes", exact: true }).first();
  await deportes.focus();
  await expect(deportes).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#desktop-dropdown-0 a").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("link", { name: "FÃºtbol Infantil" }).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deportes).toBeFocused();
  await expect(deportes).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "FÃºtbol Infantil" }).first()).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "FÃºtbol Infantil" }).first()).toBeFocused();
});

for (const width of [1100, 1200, 1366]) {
  test(`header en el entorno del breakpoint a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const logo = page.locator('header[data-mobile-nav] img[alt^="Escudo"]');
    const dimensions = await logo.evaluate((image: HTMLImageElement) => ({ width: image.width, height: image.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }));
    expect(dimensions.naturalWidth).toBeGreaterThan(0);
    expect(Math.abs(dimensions.width / dimensions.height - dimensions.naturalWidth / dimensions.naturalHeight)).toBeLessThan(0.02);
    if (width < 1280) {
      const toggle = page.locator("[data-mobile-menu-toggle]");
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.locator("[data-mobile-menu-panel]")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(page.locator("[data-mobile-menu-toggle]")).toBeHidden();
      const last = page.locator("header[data-mobile-nav] nav > ul > li:last-child a");
      const rect = await last.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    }
  });
}

test("foto ausente usa fallback institucional", async ({ page }) => {
  await page.route("**/images/deportes/futbolinfantil.jpg", (route) => route.abort());
  const pageResponse = await page.goto("/deportes/futbol-infantil");
  expect(pageResponse?.status()).toBe(200);
  const photo = page.locator("main img[data-vj-image]").first();
  await expect(photo).toHaveAttribute("src", "/images/deportes/placeholder.svg");
  await expect(photo).toHaveAttribute("alt", "FÃºtbol infantil â€” Club Social Varela Junior");
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const fallbackResponse = await page.request.get("/images/deportes/placeholder.svg");
  expect(fallbackResponse.status()).toBe(200);
  expect(fallbackResponse.headers()["content-type"]).toContain("image/svg+xml");
  const fallback = await fallbackResponse.text();
  expect(fallback).toContain("Imagen no disponible");
  expect(fallback).not.toContain("Foto del deporte");
});

test("fallback de Quincho mantiene alt contextual y etiqueta genÃ©rica", async ({ page }) => {
  const pageResponse = await page.goto("/espacios/quincho");
  expect(pageResponse?.status()).toBe(200);
  const photo = page.locator("main img[data-vj-image]").first();
  await expect(photo).toHaveAttribute("src", "/images/deportes/placeholder.svg");
  await expect(photo).toHaveAttribute("alt", "Quincho â€” Club Social Varela Junior");
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
  const fallbackResponse = await page.request.get("/images/deportes/placeholder.svg");
  expect(fallbackResponse.status()).toBe(200);
  expect(fallbackResponse.headers()["content-type"]).toContain("image/svg+xml");
  const fallback = await fallbackResponse.text();
  expect(fallback).toContain("Imagen no disponible");
  expect(fallback).not.toContain("Foto del deporte");
});

test("imagen local vÃ¡lida de Home carga sin activar fallback", async ({ page }) => {
  const pageResponse = await page.goto("/");
  expect(pageResponse?.status()).toBe(200);
  const image = page.locator('#home-hero img[data-vj-image][src="/images/padel.png"]');
  await expect(image).toHaveAttribute("alt", "Revivi tus");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(image).not.toHaveAttribute("src", "/images/deportes/placeholder.svg");
});

test("replays habilita la compra al completar cancha, dÃ­a y turno", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/replays");
  const cancha = page.getByLabel("Cancha");
  const turno = page.getByLabel("Turno");
  const buy = page.getByRole("button", { name: /COMPRAR REPLAY/ });
  await expect(buy).toBeDisabled();
  await expect.poll(() => cancha.locator("option").count()).toBeGreaterThan(1);
  await expect.poll(() => turno.locator("option").count()).toBeGreaterThan(1);
  await cancha.selectOption({ index: 1 });
  await turno.selectOption({ index: 1 });
  await expect(page.getByLabel("DÃ­a")).not.toHaveValue("");
  await expect(buy).toBeEnabled();
  await buy.focus();
  await expect(buy).toBeFocused();
});

/* ------------------------------------------------------------------ */
/*  Flujo de pago (con API mockeada, sin pago real)                    */
/* ------------------------------------------------------------------ */

const PAYMENT_TOKEN = "11111111-1111-1111-1111-111111111111";

test("pago con token invÃ¡lido muestra error sin aprobar", async ({ page }) => {
  await page.route("**/api/replays/payment/status*", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Token de acceso no encontrado" }),
    });
  });
  await page.goto(`/replays/pago?token=${PAYMENT_TOKEN}`);
  await expect(page.getByText(/hubo un problema|no se encontrÃ³|error/i).first()).toBeVisible();
});

test("pago aprobado muestra el link de acceso", async ({ page }) => {
  await page.route("**/api/replays/payment/status*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "approved",
        matchKey: "cancha-padel|2026-05-15|13:00",
        accessLink: `http://localhost/replays/ver?token=${PAYMENT_TOKEN}`,
      }),
    });
  });
  await page.goto(`/replays/pago?token=${PAYMENT_TOKEN}&status=approved`);
  await expect(page.getByText(/pago aprobado/i).first()).toBeVisible({ timeout: 15_000 });
});

test("pago rechazado muestra error", async ({ page }) => {
  await page.route("**/api/replays/payment/status*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "rejected",
        matchKey: "cancha-padel|2026-05-15|13:00",
        accessLink: "",
      }),
    });
  });
  await page.goto(`/replays/pago?token=${PAYMENT_TOKEN}`);
  await expect(page.getByText(/rechaz|no se complet|error/i).first()).toBeVisible({ timeout: 15_000 });
});

test("ver con token invÃ¡lido muestra link invÃ¡lido o error", async ({ page }) => {
  await page.route("**/api/replays/payment/access", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Token de acceso no encontrado" }),
    });
  });
  await page.goto(`/replays/ver?token=${PAYMENT_TOKEN}`);
  await expect(page.getByText(/no se pudo acceder|no encontrado|error/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
