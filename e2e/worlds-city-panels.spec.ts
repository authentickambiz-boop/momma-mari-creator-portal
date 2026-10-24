import { expect, test } from "@playwright/test";
import { shopItemsFor } from "../src/lib/worlds/economy";
import { CITY_LOCATIONS } from "../src/lib/worlds/city/locations";
import { LIVE_EMAIL_SEND, LIVE_SOCIAL_ACTIONS, tasksForLocation } from "../src/lib/worlds/city/tasks";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("live flags stay off in the browser harness", () => {
  expect(LIVE_SOCIAL_ACTIONS).toBe(false);
  expect(LIVE_EMAIL_SEND).toBe(false);
});

test("the owner opens every building panel and sees its tasks and practice submit", async ({ page }) => {
  const leaked: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/mailto:|stripe|twitter|facebook|instagram|tiktok|webhook|nodemailer/i.test(url)) leaked.push(url);
  });

  const response = await page.goto("/worlds/city/smoke");
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-city-smoke='owner']")).toHaveAttribute("data-viewer-role", "owner");
  await expect(page.getByText("Nothing is posted or emailed.")).toBeVisible();

  await page.getByRole("button", { name: "Places" }).click();
  await expect(page.getByRole("button", { name: "Owner", pressed: true })).toBeVisible();

  for (const location of CITY_LOCATIONS) {
    const places = page.getByRole("navigation", { name: "City places" });
    if (!(await places.isVisible())) await page.getByRole("button", { name: "Places" }).click();
    const opener = page.getByRole("navigation", { name: "City places" }).getByRole("button", { name: location.name, exact: true });
    await opener.scrollIntoViewIfNeeded();
    await opener.click();

    const panel = page.getByRole("region", { name: `${location.name} interior` });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { level: 2, name: location.name })).toBeVisible();

    const tasks = tasksForLocation(location.id).filter((item) => item.id !== "office-check-in");
    await expect(panel.locator("form.city-task")).toHaveCount(tasks.length);
    for (const task of tasks) {
      const form = panel.locator("form.city-task").filter({ has: page.getByRole("heading", { level: 3, name: task.name, exact: true }) });
      await expect(form).toHaveCount(1);
      const submit = form.getByRole("button", { name: "Submit in the city" });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeVisible();
    }

    if (location.id === "office") {
      await expect(panel.locator(".city-shop li").first()).toContainText("still in the office scene");
      await expect(panel.locator(".city-shop").getByText("Calendar", { exact: true }).first()).toBeVisible();
      await expect(panel.locator(".city-shop").getByText("To-dos", { exact: true }).first()).toBeVisible();
      await expect(panel.getByText(/bots on the roster/)).toBeVisible();
      await expect(panel.getByRole("button", { name: "Submit in the city" })).toHaveCount(0);
    }
    const shop = shopItemsFor(location.id);
    if (shop.length > 0) await expect(panel.locator(".city-shop li")).toHaveCount(shop.length);
    for (const item of shop) {
      const row = panel.locator(".city-shop li").filter({ hasText: item.name });
      const buy = row.getByRole("button", { name: "Buy with Kash" });
      await buy.scrollIntoViewIfNeeded();
      await expect(buy).toBeVisible();
    }
  }

  await page.getByRole("button", { name: "Places" }).click();
  await page.getByRole("navigation", { name: "City places" }).getByRole("button", { name: "Social club", exact: true }).click();
  const social = page.getByRole("region", { name: "Social club interior" });
  await expect(social.getByText("Nothing is posted").first()).toBeVisible();
  const like = social.locator("form.city-task").filter({ has: page.getByRole("heading", { name: "Like a draft", exact: true }) });
  await like.getByRole("checkbox").check();
  await like.getByRole("textbox", { name: "Like a draft" }).fill("Like the Friday clip because the cut is clear.");
  await like.getByRole("button", { name: "Submit in the city" }).click();
  await expect(social.getByText("Nothing was posted").first()).toBeVisible();
  await expect(social.getByText(/Practice score/).first()).toBeVisible();
  await expect(social.locator(".office-error")).toHaveCount(0);

  await page.getByRole("button", { name: "Places" }).click();
  await page.getByRole("navigation", { name: "City places" }).getByRole("button", { name: "Call center", exact: true }).click();
  const calls = page.getByRole("region", { name: "Call center interior" });
  await expect(calls.getByText("never auto-sent").first()).toBeVisible();
  await expect(calls.locator("form.city-task").getByRole("button", { name: "Submit in the city" })).toHaveCount(5);

  expect(leaked).toEqual([]);
});
