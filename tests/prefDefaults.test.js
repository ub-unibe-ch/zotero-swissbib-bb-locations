describe("Pref defaults fallback", () => {
  afterEach(() => {
    jest.resetModules();
  });

  test("should return defaults when Zotero.Prefs.get returns undefined", () => {
    global.Zotero = {
      Prefs: {
        get: () => undefined,
      },
      debug: console.log,
    };
    const SUL = require("../src/swisscoveryubbernlocations");
    expect(SUL.sruPrefix).toContain("slsp-ube.alma.exlibrisgroup.com");
    expect(SUL.apiKey).toBe("");
    expect(SUL.targetField).toBe("abstractNote");
  });

  test("should return defaults when Zotero.Prefs.get throws", () => {
    global.Zotero = {
      Prefs: {
        get: () => {
          throw new Error("pref not found");
        },
      },
      debug: console.log,
    };
    const SUL = require("../src/swisscoveryubbernlocations");
    expect(SUL.sruPrefix).toContain("slsp-ube.alma.exlibrisgroup.com");
    expect(SUL.apiKey).toBe("");
    expect(SUL.targetField).toBe("abstractNote");
  });

  test("should prefer user-set values over defaults", () => {
    global.Zotero = {
      Prefs: {
        get: (pref) => {
          const prefs = {
            "extensions.swisscoveryubbernlocations.sruurl": "http://custom.example.com/sru",
            "extensions.swisscoveryubbernlocations.apikey": "my-key",
            "extensions.swisscoveryubbernlocations.targetField": "extra",
          };
          return prefs[pref];
        },
      },
      debug: console.log,
    };
    const SUL = require("../src/swisscoveryubbernlocations");
    expect(SUL.sruPrefix).toBe("http://custom.example.com/sru");
    expect(SUL.apiKey).toBe("my-key");
    expect(SUL.targetField).toBe("extra");
  });
});
