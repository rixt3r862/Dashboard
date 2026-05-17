import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const pwaScriptPath = path.join(repoRoot, "shared/pwa.js");

function loadPwa(options = {}) {
  const listeners = {};
  const storage = new Map(Object.entries(options.storage ?? {}));
  const createdLinks = [];
  const createdUrls = [];
  const revokedUrls = [];

  class FakeBlob {
    constructor(parts, blobOptions) {
      this.parts = parts;
      this.options = blobOptions;
    }
  }

  const context = {
    Blob: FakeBlob,
    URL: {
      createObjectURL(blob) {
        const url = `blob:pwa-test-${createdUrls.length + 1}`;
        createdUrls.push({ blob, url });
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
    document: {
      body: {
        appended: [],
        appendChild(link) {
          this.appended.push(link);
        },
      },
      createElement(tagName) {
        assert.equal(tagName, "a");
        const link = {
          clickCount: 0,
          download: "",
          href: "",
          click() {
            this.clickCount += 1;
          },
          remove() {
            this.removed = true;
          },
        };
        createdLinks.push(link);
        return link;
      },
      currentScript: {
        dataset: {
          sw: "./sw.js",
        },
      },
    },
    location: {
      hostname: "example.com",
      pathname: "/SkyJo/",
    },
    navigator: {
      userAgent: "PWA Test Browser",
    },
    window: {
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
      localStorage: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null;
        },
        removeItem(key) {
          storage.delete(key);
        },
        setItem(key, value) {
          storage.set(key, value);
        },
      },
      location: {
        pathname: "/SkyJo/",
      },
      navigator: {
        userAgent: "PWA Test Browser",
      },
    },
  };

  context.window.document = context.document;
  context.window.URL = context.URL;
  context.window.Blob = context.Blob;

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(pwaScriptPath, "utf8"), context, {
    filename: pwaScriptPath,
  });

  return {
    context,
    createdLinks,
    createdUrls,
    listeners,
    logger: context.window.DashboardErrorLog,
    revokedUrls,
    storage,
  };
}

test("PWA client error logger records errors and rejected promises", () => {
  const { listeners, logger } = loadPwa();

  listeners.error({
    colno: 7,
    error: new Error("Card render failed"),
    filename: "/SkyJo/skyjo.js",
    lineno: 42,
    message: "Card render failed",
  });
  listeners.unhandledrejection({
    reason: new Error("Bot turn failed"),
  });

  const entries = logger.list();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, "unhandledrejection");
  assert.equal(entries[0].message, "Bot turn failed");
  assert.equal(entries[1].type, "error");
  assert.equal(entries[1].message, "Card render failed");
  assert.equal(entries[1].source, "/SkyJo/skyjo.js");
  assert.equal(entries[1].line, 42);
  assert.equal(entries[1].column, 7);
  assert.equal(entries[1].path, "/SkyJo/");
});

test("PWA client error logger filters known extension noise", () => {
  const { listeners, logger } = loadPwa();

  listeners.error({
    message: "Unchecked runtime.lastError: The message port closed before a response was received.",
  });

  assert.deepEqual(JSON.parse(JSON.stringify(logger.list())), []);
});

test("PWA client error logger exposes clear, manual record, and download helpers", () => {
  const { createdLinks, createdUrls, logger, revokedUrls } = loadPwa();

  assert.equal(logger.record({ message: "Manual note", type: "manual" }), true);
  assert.equal(logger.list().length, 1);

  logger.download();
  assert.equal(createdLinks.length, 1);
  assert.equal(createdLinks[0].clickCount, 1);
  assert.match(createdLinks[0].download, /^dashboard-client-errors-/);
  assert.equal(createdUrls.length, 1);
  assert.deepEqual(JSON.parse(Array.from(createdUrls[0].blob.parts)[0])[0].message, "Manual note");
  assert.deepEqual(revokedUrls, ["blob:pwa-test-1"]);

  assert.equal(logger.clear(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(logger.list())), []);
});
