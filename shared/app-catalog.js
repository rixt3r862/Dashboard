(function (global) {
  // URLs are relative to the Dashboard root and identify persisted pins/recents.
  // Category metadata preserves each launcher's presentation and ordering.
  const apps = [
    {
      "name": "Money Counter",
      "url": "./MoneyCounter.html",
      "icon": "💵",
      "desc": "Cash counter utility"
    },
    {
      "name": "Time Tools",
      "url": "./TimeTools/index.html",
      "icon": "🕰️",
      "desc": "Clock, timer, date math, and time conversion tools"
    },
    {
      "name": "Clock",
      "url": "./clock.html",
      "icon": "⏰",
      "desc": "Time & display clock",
      "hidden": true,
      "time": {
        "order": 0,
        "tag": "Display",
        "desc": "Quick access to the current time with a dedicated display view.",
        "meta": [
          "live time",
          "large display"
        ]
      }
    },
    {
      "name": "24h to 12h Helper",
      "url": "./Time Converter.html",
      "icon": "🕒",
      "desc": "Convert 24-hour times with quick examples and copy-ready output",
      "hidden": true,
      "time": {
        "order": 1,
        "tag": "Convert",
        "desc": "Translate 24-hour time into 12-hour format with quick examples and copy-ready output.",
        "meta": [
          "24h to 12h",
          "fast lookup"
        ]
      }
    },
    {
      "name": "Timer",
      "url": "./Timer.html",
      "icon": "⏳",
      "desc": "Countdown timer",
      "hidden": true,
      "time": {
        "order": 2,
        "tag": "Countdown",
        "desc": "Run a focused countdown timer for quick tasks and routines.",
        "meta": [
          "countdown",
          "single-purpose"
        ]
      }
    },
    {
      "name": "Time Unit Converter",
      "url": "./Time Unit Converter.html",
      "icon": "⇄",
      "desc": "Convert values between nanoseconds, centuries, and other time units",
      "hidden": true,
      "time": {
        "order": 3,
        "tag": "Units",
        "desc": "Convert values between nanoseconds, centuries, and every common time unit in between.",
        "meta": [
          "bidirectional",
          "12 units"
        ]
      }
    },
    {
      "name": "ScoreKeeper",
      "url": "./ScoreKeeper/index.html",
      "iconImg": "./ScoreKeeper/img/scorekeeper-favicon.svg",
      "icon": "♠️",
      "desc": "Game score tracking utility",
      "games": {
        "order": 8,
        "desc": "Track scores for game night.",
        "icon": "🧮"
      }
    },
    {
      "name": "Game Room",
      "url": "./Games/index.html",
      "icon": "🎲",
      "desc": "Phase 10 and future game apps in one spot"
    },
    {
      "name": "Phase 10",
      "url": "./Phase10/index.html",
      "icon": "🔟",
      "desc": "Play streamlined Phase 10 against 1-3 bots",
      "hidden": true,
      "games": {
        "order": 1,
        "desc": "Play Phase 10 against bots."
      }
    },
    {
      "name": "SkyJo",
      "url": "./SkyJo/index.html",
      "icon": "🃏",
      "desc": "Play SkyJo against 1-3 bots",
      "hidden": true,
      "games": {
        "order": 2,
        "desc": "Build the lowest card total.",
        "icon": "🌤️"
      }
    },
    {
      "name": "SkyJo Mobile",
      "url": "./SkyJo/index.html?layout=phone-landscape",
      "icon": "📱",
      "desc": "Open SkyJo with phone controls",
      "hidden": true,
      "games": {
        "order": 3,
        "desc": "Open SkyJo with phone controls."
      }
    },
    {
      "name": "Hearts",
      "url": "./Hearts/index.html",
      "icon": "♥️",
      "desc": "Play a single-device Hearts table against 3 bots",
      "hidden": true,
      "games": {
        "order": 4,
        "desc": "Avoid points and the queen."
      }
    },
    {
      "name": "Spades",
      "url": "./Spades/index.html",
      "icon": "♠️",
      "desc": "Play a single-device partnership Spades table against 3 bots",
      "hidden": true,
      "games": {
        "order": 5,
        "desc": "Bid tricks with a partner."
      }
    },
    {
      "name": "Crazy 8s",
      "url": "./Crazy8s/index.html",
      "icon": "8️⃣",
      "desc": "Play classic Crazy 8s against 1-3 bots",
      "hidden": true,
      "games": {
        "order": 6,
        "desc": "Match suits, ranks, and wild eights."
      }
    },
    {
      "name": "5 Crowns",
      "url": "./FiveCrowns/index.html",
      "icon": "👑",
      "desc": "Play 5 Crowns against 1-4 bots",
      "hidden": true,
      "games": {
        "order": 7,
        "desc": "Make books and runs by round."
      }
    },
    {
      "name": "Skip-Bo",
      "url": "./SkipBo/index.html",
      "icon": "🔢",
      "desc": "Play Skip-Bo against 1-5 bots",
      "hidden": true,
      "games": {
        "order": 0,
        "desc": "Build to twelve and clear your stock."
      }
    },
    {
      "name": "Unit Converter",
      "url": "./Unit Converter.html",
      "icon": "📐",
      "desc": "Length, weight, volume, temperature, and more"
    },
    {
      "name": "URL Encoder / Decoder",
      "url": "./URL Tool.html",
      "icon": "🔗",
      "desc": "Encode URL text or decode percent-encoded values"
    },
    {
      "name": "Notepad",
      "url": "./Notepad.html",
      "icon": "📝",
      "desc": "Large-font text pad for typing"
    },
    {
      "name": "QR Generator + Scanner",
      "url": "./QR Tool.html",
      "icon": "🔳",
      "desc": "Create QR codes and scan QR images"
    },
    {
      "name": "Date Math Tool",
      "url": "./Date Math Tool.html",
      "icon": "📅",
      "desc": "Add/subtract dates and calculate day differences",
      "hidden": true,
      "time": {
        "order": 4,
        "tag": "Calendar",
        "desc": "Add and subtract dates or calculate the gap between two days.",
        "meta": [
          "date offsets",
          "day differences"
        ]
      }
    }
  ];

  function forCategory(category) {
    return apps
      .filter((app) => app[category])
      .sort((a, b) => a[category].order - b[category].order)
      .map((app) => ({
        ...app,
        ...app[category],
        href: "../" + app.url.slice(2),
        dashboardUrl: app.url,
      }));
  }

  global.DashboardCatalog = { apps, forCategory };
})(window);
