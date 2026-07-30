import { CONFIG } from './config.js';
import { readRange, appendRow, updateRange } from './sheetsApi.js';
import { MOCK_STUDENTS, MOCK_LEDGER_WITH_BALANCE, MOCK_ACCOUNT_SUMMARY } from './mockData.js';

const LEDGER_RANGE = 'Ledger!A2:G';
const STUDENTS_RANGE = 'Students!A2:B';
const SUMMARY_RANGE = 'Summary!A1:B20'; // generous - Summary tab is short, no buffer rows needed

function excelSerialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}

function normalizeDate(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return excelSerialToDate(v);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function loadLedger() {
  if (CONFIG.USE_MOCK_DATA) {
    return {
      rows: MOCK_LEDGER_WITH_BALANCE.map(r => ({ ...r, date: new Date(r.date) })),
      students: MOCK_STUDENTS,
    };
  }
  const [ledgerValues, studentValues] = await Promise.all([
    readRange(LEDGER_RANGE),
    readRange(STUDENTS_RANGE),
  ]);
  const rows = ledgerValues
    .filter(r => r[0] !== undefined && r[0] !== '')
    .map(r => ({
      date: normalizeDate(r[0]),
      type: r[1] || '',
      who: r[2] || '',
      amountIn: num(r[3]),
      amountOut: num(r[4]),
      notes: r[5] || '',
      balance: num(r[6]),
    }));
  const students = studentValues
    .filter(r => r[0] && r[1] !== 'No')
    .map(r => r[0]);
  return { rows, students };
}

export function lastAmountForStudent(rows, name) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].type === 'Received' && rows[i].who === name) return rows[i].amountIn;
  }
  return null;
}

// Google Sheets' values.append picks the insert row by finding the first
// row that's blank across the WHOLE row, not just the columns being written
// - so the Balance formula can't be pre-filled ahead of time (that was
// tried and caused appends to skip past thousands of rows to the first
// truly-empty one; see MIGRATION_REPORT.md history). Instead, each append's
// response tells us which row it actually landed on, and we write that
// row's Balance formula ourselves right after.
function parseAppendedRow(appendResult) {
  const range = appendResult && appendResult.updates && appendResult.updates.updatedRange;
  const m = range && range.match(/![A-Za-z]+(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function addEntry({ type, who, amount, date, notes }, accessToken) {
  const amountIn = type === 'Received' ? amount : 0;
  const amountOut = type === 'Received' ? 0 : amount;
  if (CONFIG.USE_MOCK_DATA) {
    const prevBalance = MOCK_LEDGER_WITH_BALANCE.length
      ? MOCK_LEDGER_WITH_BALANCE[MOCK_LEDGER_WITH_BALANCE.length - 1].balance
      : 0;
    MOCK_LEDGER_WITH_BALANCE.push({
      date, type, who, amountIn, amountOut, notes: notes || '',
      balance: prevBalance + amountIn - amountOut,
    });
    return;
  }
  const result = await appendRow('Ledger!A:F', [date, type, who, amountIn || '', amountOut || '', notes || ''], accessToken);
  const row = parseAppendedRow(result);
  if (row) {
    await updateRange(`Ledger!G${row}`, [`=SUM($D$2:D${row})-SUM($E$2:E${row})`], accessToken);
  }
}

export async function addStudent(name, accessToken) {
  if (CONFIG.USE_MOCK_DATA) {
    if (!MOCK_STUDENTS.includes(name)) MOCK_STUDENTS.push(name);
    return;
  }
  await appendRow('Students!A:B', [name, 'Yes'], accessToken);
}

// Sana's own balance-share figure (formerly a hand-edited formula in cell
// H73 of the original sheet - see MIGRATION_REPORT.md). Row numbers for the
// two editable cells are discovered by label match here, then passed back
// into updateOverallBalance so writes stay correct even if someone reorders
// the Summary tab's rows later.
export async function loadAccountSummary(ledgerRows) {
  if (CONFIG.USE_MOCK_DATA) {
    const last = ledgerRows[ledgerRows.length - 1];
    const currentBalance = last ? last.balance : 0;
    const overallBalance = MOCK_ACCOUNT_SUMMARY.overallBalance;
    return {
      overallBalance,
      lastUpdated: MOCK_ACCOUNT_SUMMARY.lastUpdated ? new Date(MOCK_ACCOUNT_SUMMARY.lastUpdated) : null,
      sanaShare: overallBalance === null ? null : overallBalance - currentBalance,
      overallRow: null,
      lastUpdatedRow: null,
    };
  }
  const values = await readRange(SUMMARY_RANGE);
  let overallBalance = null, lastUpdated = null, sanaShare = null;
  let overallRow = null, lastUpdatedRow = null;
  values.forEach((row, i) => {
    const label = (row[0] || '').toString().trim().toLowerCase();
    if (label === 'overall account balance') {
      overallBalance = row[1] === '' || row[1] == null ? null : num(row[1]);
      overallRow = i + 1;
    } else if (label === 'balance last updated') {
      lastUpdated = normalizeDate(row[1]);
      lastUpdatedRow = i + 1;
    } else if (label === "sana's share") {
      sanaShare = row[1] === '' || row[1] == null ? null : num(row[1]);
    }
  });
  return { overallBalance, lastUpdated, sanaShare, overallRow, lastUpdatedRow };
}

export async function updateOverallBalance(newValue, { overallRow, lastUpdatedRow }, accessToken) {
  const today = new Date().toISOString().slice(0, 10);
  if (CONFIG.USE_MOCK_DATA) {
    MOCK_ACCOUNT_SUMMARY.overallBalance = newValue;
    MOCK_ACCOUNT_SUMMARY.lastUpdated = today;
    return;
  }
  await updateRange(`Summary!B${overallRow}`, [newValue], accessToken);
  await updateRange(`Summary!B${lastUpdatedRow}`, [today], accessToken);
}
