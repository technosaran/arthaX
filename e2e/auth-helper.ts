import { Page } from "@playwright/test";

export async function loginOrSignUp(page: Page, email: string = "tester@example.com", password: string = "password123") {
  console.log(`Authenticating test user: ${email}...`);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Attempt Sign In first
  const signInBtn = page.getByRole("button", { name: "Sign In", exact: true });
  if (await signInBtn.isVisible()) {
    await signInBtn.click();
  }

  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitBtn = page.locator('button[type="submit"]').or(page.getByRole("button", { name: /Access Terminal|Sign In|Log In/i }));
  await submitBtn.click();

  try {
    await page.waitForURL(/dashboard|onboarding/, { timeout: 7000 });
    console.log("Successfully logged in!");
    return;
  } catch {
    console.log("Login failed or credentials invalid, attempting automatic sign-up fallback...");
  }

  // Fallback to Sign Up
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const signUpTab = page.getByRole("button", { name: /Sign Up|Create Account/i }).or(page.locator("button", { hasText: /Sign Up/i }));
  if (await signUpTab.count() > 0 && await signUpTab.first().isVisible()) {
    await signUpTab.first().click();
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitBtn.click();

  // Give signup a moment, then attempt sign-in again if needed
  await page.waitForTimeout(2000);
  
  if (!page.url().includes("/dashboard")) {
    await page.goto("/login");
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
    }
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitBtn.click();
    await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 });
  }

  console.log("Successfully authenticated!");
}
