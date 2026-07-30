// Placeholder data for local UI testing only (js/config.js USE_MOCK_DATA).
// Intentionally fake names/amounts - never put real ledger data here, since
// this file is part of the public static site.
export const MOCK_STUDENTS = ['Asha', 'Priya', 'Rahul', 'Meera'];

export const MOCK_LEDGER = [
  { date: '2026-01-01', type: 'Opening Balance', who: 'Carried from previous year', amountIn: 50000, amountOut: 0, notes: '' },
  { date: '2026-01-05', type: 'Received', who: 'Asha', amountIn: 4500, amountOut: 0, notes: '' },
  { date: '2026-01-10', type: 'Spent for Naghma', who: 'Groceries', amountIn: 0, amountOut: 1200, notes: '' },
  { date: '2026-01-15', type: 'Received', who: 'Priya', amountIn: 6000, amountOut: 0, notes: '' },
  { date: '2026-01-20', type: 'Transferred to Naghma', who: 'Fampay', amountIn: 0, amountOut: 3000, notes: '' },
  { date: '2026-02-02', type: 'Received', who: 'Rahul', amountIn: 5000, amountOut: 0, notes: '' },
  { date: '2026-02-08', type: 'Spent for Naghma', who: 'Shoes', amountIn: 0, amountOut: 1800, notes: '(date approx.)' },
];

let balance = 0;
export const MOCK_LEDGER_WITH_BALANCE = MOCK_LEDGER.map(row => {
  balance += row.amountIn - row.amountOut;
  return { ...row, balance };
});

// Starts unset so local testing exercises both the empty-state CTA and,
// once edited, the populated display - see ledger.js loadAccountSummary().
export const MOCK_ACCOUNT_SUMMARY = {
  overallBalance: null,
  lastUpdated: null, // 'YYYY-MM-DD' once set
};
