import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import jsQR from '../vendor/jsqr/dist/jsQR.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function helpers(path, extra = {}) {
  const context = { window: {}, TextEncoder, ...extra };
  vm.runInNewContext(read(path), context);
  return context.window;
}
test('weekday counts and shifts match daily stepping across weekends and leap day', () => {
  const math = helpers('shared/date-math.js').DateMath;
  for (let start = 0; start < 14; start++) {
    const base = new Date(Date.UTC(2024, 1, 23 + start));
    for (let amount = -30; amount <= 30; amount++) {
      const expected = new Date(base);
      let left = Math.abs(amount);
      while (left) {
        expected.setUTCDate(expected.getUTCDate() + Math.sign(amount));
        if (![0, 6].includes(expected.getUTCDay())) left--;
      }
      assert.equal(math.shiftWeekdays(base, amount).toISOString(), expected.toISOString());
    }
    for (let days = 0; days < 30; days++) {
      const end = new Date(+base + days * 86400000);
      for (const inclusive of [false, true]) {
        let expected = 0;
        for (let i = 0; i < days + Number(inclusive); i++) {
          if (![0, 6].includes(new Date(+base + i * 86400000).getUTCDay())) expected++;
        }
        assert.equal(math.weekdaysBetween(base, end, inclusive), expected);
        assert.equal(math.weekdaysBetween(end, base, inclusive), expected);
      }
    }
  }
});
test('URL fields preserve duplicates, decode parameters and mark passwords secret', () => {
  const elements = { source: { value: '' }, urlParts: { replaceChildren() {} }, urlPartsStatus: {} };
  const { fields } = helpers('shared/url-fields.js', {
    URL, document: { getElementById: id => elements[id] }
  }).UrlFields;
  const rows = fields('https://alice:secret@example.com:8443/a?x=one+two&x=%26#part');
  assert.equal(rows.find(row => row[0] === 'Port')[1], '8443');
  assert.equal(rows.find(row => row[0] === 'Fragment')[1], '#part');
  assert.equal(rows.find(row => row[0] === 'Password')[2], true);
  assert.deepEqual(Array.from(rows.filter(row => row[0] === 'Parameter: x'), row => row[1]), ['one two', '&']);
  assert.throws(() => fields('not a URL'));
});
const qr = helpers('shared/qr-templates.js').QrTemplates;
function roundtrip(text, size) {
  const context = { document: { documentElement: { tagName: 'html' } }, navigator: { userAgent: 'node' } };
  vm.runInNewContext(read('vendor/qrcodejs/qrcode.min.js'), context);
  const element = { innerHTML: '', childNodes: [{ offsetWidth: 220, offsetHeight: 220, style: {} }] };
  const code = qr.encode(context.QRCode, element, text);
  const pixels = new Uint8ClampedArray(size * size * 4);
  const drawing = { fillStyle: '', fillRect(x, y, w, h) {
    const value = this.fillStyle === '#ffffff' ? 255 : 0;
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const offset = (row * size + col) * 4;
      pixels.fill(value, offset, offset + 3); pixels[offset + 3] = 255;
    }
  } };
  qr.paint(code._oQRCode, size, { getContext: () => drawing });
  return jsQR(pixels, size, size)?.data;
}
test('bundled QR encoder and decoder roundtrip text and templates offline at every size', () => {
  const payloads = [
    qr.payload('text', { text: 'Caf\u00e9' }),
    qr.payload('text', { text: 'Hello \u{1f600}' }),
    qr.payload('text', { text: 'https://example.com/?a=1&b=2' }),
    qr.payload('wifi', { ssid: 'Home;Guest', security: 'WPA', password: 'a:b,c', hidden: true }),
    qr.payload('contact', { name: 'Jane Doe', organization: 'Example, Inc.', phone: '+15551234567', email: 'jane@example.com' })
  ];
  for (const size of [256, 512, 1024]) for (const payload of payloads) assert.equal(roundtrip(payload, size), payload);
});
test('QR templates validate required fields and escape structured content', () => {
  assert.throws(() => qr.payload('wifi', { ssid: '', security: 'WPA' }));
  assert.throws(() => qr.payload('contact', { name: ' ' }));
  assert.throws(() => qr.payload('text', { text: ' ' }));
  assert.equal(qr.payload('wifi', { ssid: 'A;B', security: 'nopass', password: 'ignored' }), 'WIFI:T:nopass;S:A\\;B;H:false;;');
  assert.throws(() => qr.paint({ getModuleCount: () => 177 }, 256, {}), /larger output/);
});
