import { expect, test } from "@playwright/test";

test("Storybook muestra actividad real con imagen y horarios", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/iframe.html?id=varela-junior-actividades-activityhero--natacion-jubilados&viewMode=story");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NATACIÓN JUBILADOS");
  await expect(page.getByRole("heading", { level: 2, name: /Horarios/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Storybook muestra botón y tarjeta de noticias", async ({ page }) => {
  await page.goto("/iframe.html?id=varela-junior-acciones-button--disabled&viewMode=story");
  await expect(page.getByRole("button", { name: "No disponible" })).toBeDisabled();
  await page.goto("/iframe.html?id=varela-junior-contenido-newscard--default&viewMode=story");
  await expect(page.getByRole("heading", { name: /Torneo Relámpago/ })).toBeVisible();
});
