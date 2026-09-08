import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const games = ['Hearts', 'Spades', 'Crazy8s', 'Phase10', 'FiveCrowns', 'SkyJo', 'SkipBo'];
for (const game of games) {
  test(game + ' keeps consistent session commands and accessible panel controls', () => {
    const html = fs.readFileSync(new URL('../' + game + '/index.html', import.meta.url), 'utf8');
    const buttons = [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(m => m[0]);
    const byId = id => buttons.find(b => b.includes('id="' + id + '"'));
    const suffix = game === 'SkipBo' ? '' : 'Btn';
    for (const [id, label] of [['resetTable', 'Reset Table'], ['loadSession', 'Load Session'], ['deleteSession', 'Delete Session']]) {
      assert.ok(byId(id + suffix)?.includes('>' + label + '</button>'), id);
    }
    const toggle = buttons.find(b => /id="(?:sessionToggle|sessionToggleBtn|sessionToolsToggle)"/.test(b));
    const target = toggle.match(/aria-controls="([^"]+)"/)?.[1];
    assert.ok(target);
    assert.ok(html.includes('id="' + target + '"'));
    assert.match(toggle, /aria-expanded="(?:true|false)"/);
    assert.match(html.match(/<p\b[^>]*id="sessionStatus"[^>]*>/)[0], /role="status"/);
    for (const button of buttons) assert.match(button, /type="(?:button|submit)"/);
    assert.match(byId('startGame' + suffix), /type="submit"/);
  });
}
