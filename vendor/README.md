# QR Dependencies

Bundled unchanged from npm packages; runtime generation/scanning needs no CDN.

The shared/qr-templates.js adapter supplies standard UTF-8 bytes to the pinned
qrcodejs model to avoid its legacy BOM and surrogate-pair conversion behavior.
Roundtrip tests cover this internal API dependency before library upgrades.

- qrcodejs 1.0.0: qrcode.min.js; MIT license in qrcodejs/LICENSE.
  npm tarball SHA-1: afab5e9e858521f859ae336d2ed0f9fd2e76cca7.
- jsqr 1.4.0: dist/jsQR.js; Apache-2.0 license in jsqr/LICENSE.
  npm tarball SHA-1: 8efb8d0a7cc6863cb6d95116b9069123ce9eb2d1.

The service worker precaches both scripts for installed/offline use after the
first successful online installation. Camera access still requires browser
permission and a secure origin (HTTPS or localhost).
