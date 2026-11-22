import { expect, test } from "@playwright/test";
import { launchDesktop, makeUserDataDir } from "../helpers/electron-app";

// The app name is more than a label. It is the macOS app-menu title, and it is the name
// of the default data folder (see app.setName in main.ts).
test("the running app is named Theta", async () => {
  const harness = await launchDesktop(await makeUserDataDir(), { testMode: "background" });

  try {
    const window = await harness.firstWindow();
    await expect(window).toHaveTitle("Theta");

    const appName = await harness.electronApp.evaluate(({ app }) => app.getName());
    expect(appName).toBe("Theta");

    if (process.platform === "darwin") {
      // The first menu's label comes from app.name. It is installed after the window opens.
      await expect
        .poll(() =>
          harness.electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0]?.label),
        )
        .toBe("Theta");
    }
  } finally {
    await harness.close();
  }
});
