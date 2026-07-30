import { CONFIG } from './config.js';
import { initAuth, signIn, signOut, isSignedIn, getAccessToken, getEmail } from './auth.js';
import { loadLedger, lastAmountForStudent, addEntry, updateEntry, deleteEntry, addStudent, loadAccountSummary, updateOverallBalance } from './ledger.js';
import { initTheme } from './theme.js';

const els = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  signInBtn: document.getElementById('signInBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  signedInAs: document.getElementById('signedInAs'),
  balanceAmount: document.getElementById('balanceAmount'),
  balanceSub: document.getElementById('balanceSub'),
  monthFilter: document.getElementById('monthFilter'),
  accountSummaryLine: document.getElementById('accountSummaryLine'),
  accountSummaryText: document.getElementById('accountSummaryText'),
  editAccountBalanceBtn: document.getElementById('editAccountBalanceBtn'),
  balanceDialogBackdrop: document.getElementById('balanceDialogBackdrop'),
  closeBalanceDialogBtn: document.getElementById('closeBalanceDialogBtn'),
  balanceForm: document.getElementById('balanceForm'),
  overallBalanceInput: document.getElementById('overallBalanceInput'),
  balanceFormError: document.getElementById('balanceFormError'),
  submitBalanceBtn: document.getElementById('submitBalanceBtn'),
  txList: document.getElementById('txList'),
  txEmpty: document.getElementById('txEmpty'),
  txLoading: document.getElementById('txLoading'),
  addEntryFab: document.getElementById('addEntryFab'),
  entryDialogBackdrop: document.getElementById('entryDialogBackdrop'),
  entryDialogTitle: document.getElementById('entryDialogTitle'),
  closeDialogBtn: document.getElementById('closeDialogBtn'),
  entryForm: document.getElementById('entryForm'),
  typeToggle: document.getElementById('typeToggle'),
  typeInput: document.getElementById('typeInput'),
  receivedFields: document.getElementById('receivedFields'),
  spentFields: document.getElementById('spentFields'),
  transferredFields: document.getElementById('transferredFields'),
  studentSelect: document.getElementById('studentSelect'),
  newStudentInput: document.getElementById('newStudentInput'),
  sourceInput: document.getElementById('sourceInput'),
  channelSelect: document.getElementById('channelSelect'),
  channelOtherInput: document.getElementById('channelOtherInput'),
  amountInput: document.getElementById('amountInput'),
  dateInput: document.getElementById('dateInput'),
  notesInput: document.getElementById('notesInput'),
  formError: document.getElementById('formError'),
  submitEntryBtn: document.getElementById('submitEntryBtn'),
  toast: document.getElementById('toast'),
  deleteDialogBackdrop: document.getElementById('deleteDialogBackdrop'),
  closeDeleteDialogBtn: document.getElementById('closeDeleteDialogBtn'),
  deleteDialogMessage: document.getElementById('deleteDialogMessage'),
  deleteFormError: document.getElementById('deleteFormError'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
};

let ledgerData = { rows: [], students: [] };
let accountSummary = { overallBalance: null, lastUpdated: null, sanaShare: null, overallRow: null, lastUpdatedRow: null };
let toastTimer = null;
let editingRow = null;
let pendingDeleteRow = null;

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function updateAuthUI() {
  const signedIn = isSignedIn();
  els.signInBtn.hidden = signedIn;
  els.signOutBtn.hidden = !signedIn;
  els.signedInAs.hidden = !signedIn;
  els.signedInAs.textContent = getEmail() || '';
  els.addEntryFab.hidden = !signedIn;
  renderAccountSummary();
  renderTxList();
}

function renderAccountSummary() {
  // Signed-in only: Sana's own balance share is more private than the
  // tuition ledger itself (see plan). This is a UI-level hide only - the
  // underlying read still works for anyone with the link, same as the rest
  // of the dashboard.
  if (!isSignedIn()) {
    els.accountSummaryLine.hidden = true;
    return;
  }
  els.accountSummaryLine.hidden = false;
  if (accountSummary.overallBalance === null) {
    els.accountSummaryText.textContent = 'Add your account balance to see your share';
  } else {
    const asOf = accountSummary.lastUpdated
      ? ` (as of ${accountSummary.lastUpdated.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
      : '';
    els.accountSummaryText.textContent =
      `Sana's share: ${rupees(accountSummary.sanaShare)} · Account balance ${rupees(accountSummary.overallBalance)}${asOf}`;
  }
}

function renderMonthOptions() {
  const keys = [...new Set(ledgerData.rows.filter(r => r.date).map(r => monthKey(r.date)))].sort().reverse();
  const current = els.monthFilter.value || (keys[0] || 'all');
  els.monthFilter.innerHTML = '<option value="all">All</option>' +
    keys.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('');
  els.monthFilter.value = keys.includes(current) ? current : 'all';
}

function renderBalance() {
  const last = ledgerData.rows[ledgerData.rows.length - 1];
  els.balanceAmount.textContent = last ? rupees(last.balance) : rupees(0);
  els.balanceSub.textContent = last && last.date
    ? `as of ${last.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';
}

function renderTxList() {
  const filter = els.monthFilter.value;
  const filtered = ledgerData.rows
    .filter(r => filter === 'all' || (r.date && monthKey(r.date) === filter))
    .slice()
    .reverse()
    .slice(0, 50);

  els.txLoading.hidden = true;
  els.txList.innerHTML = '';
  els.txEmpty.hidden = filtered.length !== 0;

  const signedIn = isSignedIn();
  for (const r of filtered) {
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.dataset.row = r.row;
    const isIn = r.amountIn > 0;
    const amount = isIn ? r.amountIn : r.amountOut;
    const dateStr = r.date ? r.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
    const actions = signedIn ? `
      <div class="tx-actions">
        <button type="button" class="btn-link-edit tx-edit-btn" aria-label="Edit entry" title="Edit entry">&#9998;</button>
        <button type="button" class="btn-link-delete tx-delete-btn" aria-label="Delete entry" title="Delete entry">&#128465;</button>
      </div>` : '';
    li.innerHTML = `
      <div class="tx-main">
        <div class="tx-who">${escapeHtml(r.who || r.type)}</div>
        <div class="tx-meta">${escapeHtml(r.type)}${dateStr ? ' &middot; ' + dateStr : ''}${r.notes ? ' &middot; ' + escapeHtml(r.notes) : ''}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${rupees(amount)}</div>
        ${actions}
      </div>
    `;
    els.txList.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderStudentOptions() {
  const options = ledgerData.students.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  els.studentSelect.innerHTML = options + '<option value="__new__">+ Add new student&hellip;</option>';
}

async function refreshData() {
  els.txLoading.hidden = false;
  try {
    ledgerData = await loadLedger();
    accountSummary = await loadAccountSummary(ledgerData.rows);
  } catch (e) {
    console.error(e);
    els.txLoading.textContent = 'Could not load data. Check your connection and try again.';
    return;
  }
  renderMonthOptions();
  renderBalance();
  renderTxList();
  renderStudentOptions();
  renderAccountSummary();
}

function setActiveType(type) {
  els.typeInput.value = type;
  [...els.typeToggle.children].forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
  els.receivedFields.hidden = type !== 'Received';
  els.spentFields.hidden = type !== 'Spent for Naghma';
  els.transferredFields.hidden = type !== 'Transferred to Naghma';
}

function openDialog() {
  editingRow = null;
  els.entryDialogTitle.textContent = 'Add Entry';
  els.submitEntryBtn.textContent = 'Save Entry';
  els.entryForm.reset();
  setActiveType('Received');
  els.dateInput.value = new Date().toISOString().slice(0, 10);
  els.newStudentInput.hidden = true;
  els.channelOtherInput.hidden = true;
  els.formError.hidden = true;
  renderStudentOptions();
  els.entryDialogBackdrop.hidden = false;
}

const ENTRY_TYPES = ['Received', 'Spent for Naghma', 'Transferred to Naghma'];

// Reuses the add-entry dialog/form - only differs in which fields are
// prefilled and which ledger.js function onSubmitEntry calls (see
// editingRow). Entries with a type outside the three the form supports
// (e.g. a migrated "Opening Balance" row) fall back to "Received" so the
// dialog has something sensible to show; editing such a row still works,
// it just recategorizes it.
function openEditDialog(entry) {
  editingRow = entry.row;
  els.entryDialogTitle.textContent = 'Edit Entry';
  els.submitEntryBtn.textContent = 'Save Changes';
  els.entryForm.reset();
  els.formError.hidden = true;
  renderStudentOptions();

  const type = ENTRY_TYPES.includes(entry.type) ? entry.type : 'Received';
  setActiveType(type);
  els.dateInput.value = entry.date ? entry.date.toISOString().slice(0, 10) : '';
  els.amountInput.value = entry.amountIn > 0 ? entry.amountIn : entry.amountOut;
  els.notesInput.value = entry.notes || '';
  els.newStudentInput.hidden = true;
  els.channelOtherInput.hidden = true;

  if (type === 'Received') {
    const known = [...els.studentSelect.options].some(o => o.value === entry.who);
    if (known) {
      els.studentSelect.value = entry.who;
    } else {
      els.studentSelect.value = '__new__';
      els.newStudentInput.value = entry.who;
      els.newStudentInput.hidden = false;
    }
  } else if (type === 'Spent for Naghma') {
    els.sourceInput.value = entry.who;
  } else {
    const known = [...els.channelSelect.options].some(o => o.value === entry.who);
    if (known) {
      els.channelSelect.value = entry.who;
    } else {
      els.channelSelect.value = '__other__';
      els.channelOtherInput.value = entry.who;
      els.channelOtherInput.hidden = false;
    }
  }

  els.entryDialogBackdrop.hidden = false;
}

function closeDialog() {
  els.entryDialogBackdrop.hidden = true;
  editingRow = null;
}

function openBalanceDialog() {
  els.balanceForm.reset();
  els.balanceFormError.hidden = true;
  if (accountSummary.overallBalance !== null) {
    els.overallBalanceInput.value = accountSummary.overallBalance;
  }
  els.balanceDialogBackdrop.hidden = false;
}

function closeBalanceDialog() {
  els.balanceDialogBackdrop.hidden = true;
}

function openDeleteDialog(entry) {
  pendingDeleteRow = entry.row;
  const amount = entry.amountIn > 0 ? entry.amountIn : entry.amountOut;
  const dateStr = entry.date
    ? entry.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  els.deleteDialogMessage.textContent =
    `Delete "${entry.who || entry.type}" (${rupees(amount)}${dateStr ? ', ' + dateStr : ''})? ` +
    `This removes the row from the Google Sheet and can't be undone from the app.`;
  els.deleteFormError.hidden = true;
  els.deleteDialogBackdrop.hidden = false;
}

function closeDeleteDialog() {
  els.deleteDialogBackdrop.hidden = true;
  pendingDeleteRow = null;
}

function wireEvents() {
  els.signInBtn.addEventListener('click', () => signIn(updateAuthUI));
  els.signOutBtn.addEventListener('click', () => signOut(updateAuthUI));
  els.addEntryFab.addEventListener('click', openDialog);
  els.closeDialogBtn.addEventListener('click', closeDialog);
  els.entryDialogBackdrop.addEventListener('click', (e) => { if (e.target === els.entryDialogBackdrop) closeDialog(); });
  els.monthFilter.addEventListener('change', renderTxList);

  els.typeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment');
    if (btn) setActiveType(btn.dataset.type);
  });

  els.studentSelect.addEventListener('change', () => {
    const val = els.studentSelect.value;
    els.newStudentInput.hidden = val !== '__new__';
    if (val !== '__new__') {
      const last = lastAmountForStudent(ledgerData.rows, val);
      if (last) els.amountInput.value = last;
    } else {
      els.amountInput.value = '';
    }
  });

  els.channelSelect.addEventListener('change', () => {
    els.channelOtherInput.hidden = els.channelSelect.value !== '__other__';
  });

  els.entryForm.addEventListener('submit', onSubmitEntry);

  els.editAccountBalanceBtn.addEventListener('click', openBalanceDialog);
  els.closeBalanceDialogBtn.addEventListener('click', closeBalanceDialog);
  els.balanceDialogBackdrop.addEventListener('click', (e) => { if (e.target === els.balanceDialogBackdrop) closeBalanceDialog(); });
  els.balanceForm.addEventListener('submit', onSubmitBalance);

  els.txList.addEventListener('click', (e) => {
    const li = e.target.closest('.tx-item');
    if (!li) return;
    const entry = ledgerData.rows.find(r => r.row === Number(li.dataset.row));
    if (!entry) return;
    if (e.target.closest('.tx-edit-btn')) openEditDialog(entry);
    else if (e.target.closest('.tx-delete-btn')) openDeleteDialog(entry);
  });

  els.closeDeleteDialogBtn.addEventListener('click', closeDeleteDialog);
  els.cancelDeleteBtn.addEventListener('click', closeDeleteDialog);
  els.deleteDialogBackdrop.addEventListener('click', (e) => { if (e.target === els.deleteDialogBackdrop) closeDeleteDialog(); });
  els.confirmDeleteBtn.addEventListener('click', onConfirmDelete);
}

async function onSubmitBalance(e) {
  e.preventDefault();
  els.balanceFormError.hidden = true;

  if (!isSignedIn()) {
    els.balanceFormError.textContent = 'Please sign in first.';
    els.balanceFormError.hidden = false;
    return;
  }

  const newValue = Number(els.overallBalanceInput.value);
  if (!newValue || newValue <= 0) {
    els.balanceFormError.textContent = 'Enter a valid amount.';
    els.balanceFormError.hidden = false;
    return;
  }

  if (!CONFIG.USE_MOCK_DATA && (!accountSummary.overallRow || !accountSummary.lastUpdatedRow)) {
    els.balanceFormError.textContent = 'Summary tab is missing the expected rows - see SETUP.md.';
    els.balanceFormError.hidden = false;
    return;
  }

  els.submitBalanceBtn.disabled = true;
  els.submitBalanceBtn.textContent = 'Saving…';
  try {
    await updateOverallBalance(newValue, {
      overallRow: accountSummary.overallRow,
      lastUpdatedRow: accountSummary.lastUpdatedRow,
    }, getAccessToken());
    closeBalanceDialog();
    showToast('Account balance updated');
    await refreshData();
  } catch (err) {
    console.error(err);
    els.balanceFormError.textContent = err.message.includes('403')
      ? "You don't have edit access to this sheet."
      : 'Could not save. Check your connection and try again.';
    els.balanceFormError.hidden = false;
  } finally {
    els.submitBalanceBtn.disabled = false;
    els.submitBalanceBtn.textContent = 'Save';
  }
}

async function onConfirmDelete() {
  if (pendingDeleteRow === null) return;
  if (!isSignedIn()) {
    els.deleteFormError.textContent = 'Please sign in first.';
    els.deleteFormError.hidden = false;
    return;
  }

  els.deleteFormError.hidden = true;
  els.confirmDeleteBtn.disabled = true;
  els.confirmDeleteBtn.textContent = 'Deleting…';
  try {
    await deleteEntry(pendingDeleteRow, getAccessToken());
    closeDeleteDialog();
    showToast('Entry deleted');
    await refreshData();
  } catch (err) {
    console.error(err);
    els.deleteFormError.textContent = err.message.includes('403')
      ? "You don't have edit access to this sheet."
      : 'Could not delete. Check your connection and try again.';
    els.deleteFormError.hidden = false;
  } finally {
    els.confirmDeleteBtn.disabled = false;
    els.confirmDeleteBtn.textContent = 'Delete';
  }
}

async function onSubmitEntry(e) {
  e.preventDefault();
  els.formError.hidden = true;

  if (!isSignedIn()) {
    els.formError.textContent = 'Please sign in first.';
    els.formError.hidden = false;
    return;
  }

  const type = els.typeInput.value;
  const amount = Number(els.amountInput.value);
  const date = els.dateInput.value;
  const notes = els.notesInput.value.trim();

  if (!amount || amount <= 0) {
    els.formError.textContent = 'Enter a valid amount.';
    els.formError.hidden = false;
    return;
  }

  let who = '';
  if (type === 'Received') {
    who = els.studentSelect.value === '__new__' ? els.newStudentInput.value.trim() : els.studentSelect.value;
    if (!who) {
      els.formError.textContent = 'Enter or select a student.';
      els.formError.hidden = false;
      return;
    }
  } else if (type === 'Spent for Naghma') {
    who = els.sourceInput.value.trim();
    if (!who) {
      els.formError.textContent = 'Describe what it was for.';
      els.formError.hidden = false;
      return;
    }
  } else {
    who = els.channelSelect.value === '__other__' ? els.channelOtherInput.value.trim() : els.channelSelect.value;
    if (!who) {
      els.formError.textContent = 'Enter a channel.';
      els.formError.hidden = false;
      return;
    }
  }

  const isEdit = editingRow !== null;
  els.submitEntryBtn.disabled = true;
  els.submitEntryBtn.textContent = 'Saving…';
  try {
    const token = getAccessToken();
    if (type === 'Received' && els.studentSelect.value === '__new__') {
      await addStudent(who, token);
    }
    if (isEdit) {
      await updateEntry({ row: editingRow, type, who, amount, date, notes }, token);
    } else {
      await addEntry({ type, who, amount, date, notes }, token);
    }
    closeDialog();
    showToast(isEdit ? 'Entry updated' : 'Entry saved');
    await refreshData();
  } catch (err) {
    console.error(err);
    els.formError.textContent = err.message.includes('403')
      ? "You don't have edit access to this sheet."
      : 'Could not save. Check your connection and try again.';
    els.formError.hidden = false;
  } finally {
    els.submitEntryBtn.disabled = false;
    els.submitEntryBtn.textContent = isEdit ? 'Save Changes' : 'Save Entry';
  }
}

function initGoogleSignIn() {
  if (CONFIG.USE_MOCK_DATA) return; // auth.js handles mock sign-in state directly
  const start = () => initAuth({ onSignedIn: updateAuthUI });
  if (window.google && window.google.accounts) start();
  else window.addEventListener('load', start);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

els.signInBtn.hidden = false;
initTheme(els.themeToggleBtn);
wireEvents();
updateAuthUI();
initGoogleSignIn();
refreshData();
