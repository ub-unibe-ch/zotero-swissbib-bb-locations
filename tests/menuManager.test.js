describe("SUL Plugin - MenuManager registration", () => {
  let mockRegisterMenu;
  let mockUnregisterMenu;
  let SUL;

  beforeEach(() => {
    jest.resetModules();
    mockRegisterMenu = jest.fn(() => "menu-handle-123");
    mockUnregisterMenu = jest.fn();
    global.Zotero = {
      Prefs: {
        get: () => undefined,
      },
      MenuManager: {
        registerMenu: mockRegisterMenu,
        unregisterMenu: mockUnregisterMenu,
      },
      debug: () => {},
    };
    SUL = require("../src/swisscoveryubbernlocations");
    SUL.initialized = false;
    SUL.init({
      id: "zoteroswisscoveryubbernlocations@ubbe.org",
      version: "0.4.0",
      rootURI: "chrome://test/",
    });
  });

  test("registerMenu calls Zotero.MenuManager.registerMenu with correct target and pluginID", () => {
    SUL.registerMenu();
    expect(mockRegisterMenu).toHaveBeenCalledTimes(1);
    const config = mockRegisterMenu.mock.calls[0][0];
    expect(config.target).toBe("main/library/item");
    expect(config.pluginID).toBe("zoteroswisscoveryubbernlocations@ubbe.org");
    expect(config.menuID).toBe("swisscoveryubbernlocations-itemmenu");
  });

  test("registerMenu stores returned handle for later unregistration", () => {
    SUL.registerMenu();
    expect(SUL.menuID).toBe("menu-handle-123");
  });

  test("registered submenu exposes LocationLookup and addOrderNote as menu items", () => {
    SUL.registerMenu();
    const config = mockRegisterMenu.mock.calls[0][0];
    const submenu = config.menus[0];
    expect(submenu.menuType).toBe("submenu");
    const ids = submenu.menus.map((m) => m.l10nID);
    expect(ids).toContain("zoteroswisscoveryubbernlocations-itemmenu-locationlookup");
    expect(ids).toContain("zoteroswisscoveryubbernlocations-itemmenu-orderNoteToAbstract");
    expect(ids).toContain("zoteroswisscoveryubbernlocations-itemmenu-clearOrderNotes");
  });

  test("clearOrderNotes menu item is hidden when debug pref is false", () => {
    global.Zotero.Prefs.get = (key) =>
      key === "extensions.swisscoveryubbernlocations.debug" ? false : undefined;
    SUL.registerMenu();
    const clearItem = mockRegisterMenu.mock.calls[0][0].menus[0].menus.find(
      (m) => m.l10nID === "zoteroswisscoveryubbernlocations-itemmenu-clearOrderNotes"
    );
    const setVisible = jest.fn();
    clearItem.onShowing({}, { setVisible });
    expect(setVisible).toHaveBeenCalledWith(false);
  });

  test("clearOrderNotes menu item is visible when debug pref is true", () => {
    global.Zotero.Prefs.get = (key) =>
      key === "extensions.swisscoveryubbernlocations.debug" ? true : undefined;
    SUL.registerMenu();
    const clearItem = mockRegisterMenu.mock.calls[0][0].menus[0].menus.find(
      (m) => m.l10nID === "zoteroswisscoveryubbernlocations-itemmenu-clearOrderNotes"
    );
    const setVisible = jest.fn();
    clearItem.onShowing({}, { setVisible });
    expect(setVisible).toHaveBeenCalledWith(true);
  });

  test("unregisterMenu calls Zotero.MenuManager.unregisterMenu with stored handle", () => {
    SUL.registerMenu();
    SUL.unregisterMenu();
    expect(mockUnregisterMenu).toHaveBeenCalledWith("menu-handle-123");
    expect(SUL.menuID).toBeNull();
  });

  test("unregisterMenu is a no-op when nothing is registered", () => {
    SUL.menuID = null;
    SUL.unregisterMenu();
    expect(mockUnregisterMenu).not.toHaveBeenCalled();
  });
});
