(function () {
  const MAX = 100000000000;
  function money(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (!/^(?:\d+|\d*\.\d{1,2})(?:\.\d{1,2})?$/.test(text) || text.split('.').length > 2) return null;
    const [whole, fraction = ''] = text.split('.');
    const cents = Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents <= MAX ? cents : null;
  }
  function count(value) {
    const text = String(value ?? '').trim();
    return !text ? 0 : /^\d+$/.test(text) && Number(text) <= 1000000 ? Number(text) : null;
  }
  function totals(draft, denoms) {
    let cash = 0, checks = 0;
    for (const d of denoms) {
      const n = count(draft.cash?.[d.key]);
      if (n === null) throw Error('Cash counts must be whole numbers from 0 to 1,000,000.');
      cash += n * d.cents;
    }
    for (const value of draft.checks) {
      const cents = money(value);
      if (cents === null) throw Error('Amounts must be nonnegative with at most two decimal places.');
      checks += cents;
    }
    const expected = money(draft.expectedTotal);
    if (expected === null) throw Error('Expected total must be nonnegative with at most two decimal places.');
    if (cash + checks > MAX) throw Error('Deposit total exceeds the supported limit of $1,000,000,000.');
    return { cash, checks, total: cash + checks, expected, difference: cash + checks - expected };
  }
  function csv(records, denoms) {
    const cell = value => {
      let text = String(value ?? '');
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [['Name', 'Deposit Date', 'Account', 'Notes', 'Saved At', 'Cash', 'Checks', 'Total', 'Expected', 'Difference', ...denoms.map(d => d.label + ' count'), 'Check Amounts']];
    for (const record of records) {
      const d = record.draft, t = totals(d, denoms), dollars = n => (n / 100).toFixed(2);
      rows.push([d.depositName, d.depositDate, d.depositAccount, d.depositNotes, record.savedAt,
        dollars(t.cash), dollars(t.checks), dollars(t.total),
        d.expectedTotal ? dollars(t.expected) : '', d.expectedTotal ? dollars(t.difference) : '',
        ...denoms.map(n => count(d.cash[n.key])), d.checks.filter(v => String(v).trim()).map(v => dollars(money(v))).join('; ')]);
    }
    return rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  window.CashBox = { money, count, totals, csv };
})();
