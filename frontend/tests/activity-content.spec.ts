import { expect, test } from "@playwright/test";
import { getDeporteBySlug } from "../src/data/deportes";
import { getEspacioBySlug } from "../src/data/espacios";

for (const slug of [
  "futbol-infantil", "futbol-5", "padel", "basquet", "rugby", "fight-club",
  "natacion-bebes", "natacion-ninos", "natacion", "natacion-master",
  "natacion-jubilados", "aqua-gym", "terapia-acuatica", "pileta-libre",
]) {
  test(`contenido de actividad ${slug} coincide con datos`, async ({ page }) => {
    const data = getDeporteBySlug(slug)!;
    expect(data).toBeDefined();
    expect((await page.goto(`/deportes/${slug}`))?.status()).toBe(200);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(data.title);
    for (const paragraph of data.paragraphs) await expect(main).toContainText(paragraph);
    if (data.scheduleTitle && (data.scheduleItems?.length || data.scheduleGroups?.length)) {
      await expect(main.getByRole("heading", { level: 2, name: data.scheduleTitle })).toBeVisible();
      for (const item of data.scheduleItems ?? []) await expect(main).toContainText(item);
      for (const group of data.scheduleGroups ?? []) {
        await expect(main).toContainText(group.title);
        for (const line of group.lines) await expect(main).toContainText(line);
        for (const entry of group.entries ?? []) await expect(main).toContainText(entry.value);
        for (const subgroup of group.groups ?? []) {
          await expect(main).toContainText(subgroup.title);
          for (const line of subgroup.lines) await expect(main).toContainText(line);
          for (const entry of subgroup.entries ?? []) await expect(main).toContainText(entry.value);
        }
      }
    }
    const phones = data.contactPhones?.length ? data.contactPhones : data.contactPhone && data.contactPhoneHref ? [{ phone: data.contactPhone, phoneHref: data.contactPhoneHref }] : [];
    for (const phone of phones) await expect(main.getByRole("link", { name: phone.phone })).toHaveAttribute("href", phone.phoneHref);
    for (const [label, href] of [["WhatsApp", data.whatsappUrl], ["Instagram", data.instagramUrl]]) {
      if (href) await expect(main.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    const photo = main.locator("img[data-vj-image]").first();
    await expect(photo).toHaveAttribute("src", data.imageSrc);
    await expect(photo).toHaveAttribute("alt", data.imageAlt);
    await expect(photo).toHaveAttribute("loading", "eager");
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });
}

for (const slug of ["quincho", "salon-multieventos"]) {
  test(`contenido de espacio ${slug} coincide con datos`, async ({ page }) => {
    const data = getEspacioBySlug(slug)!;
    expect(data).toBeDefined();
    expect((await page.goto(`/espacios/${slug}`))?.status()).toBe(200);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(data.title);
    for (const paragraph of data.paragraphs) await expect(main).toContainText(paragraph);
    for (const feature of data.features ?? []) await expect(main).toContainText(feature);
    for (const item of data.scheduleItems ?? []) await expect(main).toContainText(item);
    const phones = data.contactPhones?.length ? data.contactPhones : data.contactPhone && data.contactPhoneHref ? [{ phone: data.contactPhone, phoneHref: data.contactPhoneHref }] : [];
    for (const phone of phones) await expect(main.getByRole("link", { name: phone.phone })).toHaveAttribute("href", phone.phoneHref);
    await expect(main.getByRole("link", { name: "Solicitar reserva" })).toHaveAttribute("href", data.reservaHref);
    for (const [label, href] of [["WhatsApp", data.whatsappUrl], ["Instagram", data.instagramUrl]]) {
      if (href) await expect(main.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    await expect(main.locator("img[data-vj-image]").first()).toHaveAttribute("src", data.imageSrc);
  });
}
