const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, Buffer, process: { env: {} }, require(name) { if (name in dependencies) return dependencies[name]; throw Error(name); },
  });
  return module.exports;
}
function fixture(balance = 30000) {
  let state = { balance, payments: [], entries: [], orders: [] }, mutex = Promise.resolve();
  const checkout = load('src/services/checkout-payment.service.js', { crypto, razorpay: class {} });
  const wallet = load('src/services/wallet-checkout.service.js', {
    crypto, './checkout-payment.service': checkout,
    '../models/user.model': { findByPk: async (id, { transaction: t }) => {
      await t.lock();
      return { id, isActive: true, walletBalance: t.state.balance, update: async data => { t.state.balance = data.walletBalance; } };
    } },
    '../models/payment.model': {
      findOne: async ({ where, transaction: t }) => {
        const p = t.state.payments.find(p => Object.entries(where).every(([k, v]) => p[k] === v));
        if (p) p.update = async data => { Object.assign(p, data); };
        return p;
      },
      create: async (data, { transaction: t }) => { t.state.payments.push(data); },
    },
    '../models/order.model': { findByPk: async (id, { transaction: t }) => t.state.orders.find(o => o.id === id) },
    '../models/wallet-transaction.model': {
      findOne: async ({ where, transaction: t }) => t.state.entries.find(e => Object.entries(where).every(([k, v]) => e[k] === v)),
      create: async (data, { transaction: t }) => { t.state.entries.push(data); },
    },
  });
  async function transaction(fn) {
    let release, locked = false;
    const t = { LOCK: { UPDATE: 'UPDATE' }, async lock() {
      if (locked) return;
      const previous = mutex; mutex = new Promise(resolve => { release = resolve; });
      await previous; locked = true;
      t.state = JSON.parse(JSON.stringify(state));
    } };
    try { const result = await fn(t); state = JSON.parse(JSON.stringify(t.state)); return result; }
    finally { release?.(); }
  }
  const body = { request_id: 'checkout_request_00001', items: [{ id: 7, qty: 2 }], lat: 28.6, lng: 77.2 };
  async function pay(request = body, total = 200) {
    return transaction(async t => {
      const checkoutState = await wallet.begin(3, request, 'grocery', t);
      if (checkoutState.existing) return checkoutState.existing;
      const order = { id: 10 + t.state.orders.length, customerId: 3 };
      t.state.orders.push(order);
      await wallet.debit(checkoutState, order, total, t);
      return order;
    });
  }
  return { wallet, transaction, body, pay, state: () => state };
}

test('wallet debits paise exactly and creates one paid record and ledger entry', async () => {
  const f = fixture(); await f.pay();
  assert.equal(f.state().balance, 10000);
  assert.equal(f.state().entries[0].amount, 20000);
  assert.equal(f.state().payments[0].amount, 200);
  assert.equal(f.state().payments[0].gateway, 'wallet');
  assert.equal(f.state().payments[0].status, 'paid');
});
test('insufficient balance rolls back without order, payment or balance changes', async () => {
  const f = fixture(1000); await assert.rejects(f.pay(), /Insufficient/);
  assert.equal(f.state().balance, 1000); assert.equal(f.state().orders.length, 0); assert.equal(f.state().entries.length, 0);
});
test('repeated and concurrent checkout request creates only one debit', async () => {
  const f = fixture(); const [first, second] = await Promise.all([f.pay(), f.pay()]);
  assert.equal(first.id, second.id); assert.equal(f.state().entries.length, 1); assert.equal(f.state().balance, 10000);
});
test('two distinct simultaneous purchases cannot overdraw the same balance', async () => {
  const f = fixture(); const results = await Promise.allSettled([f.pay(), f.pay({ ...f.body, request_id: 'checkout_request_00002' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state().balance, 10000); assert.equal(f.state().entries.length, 1);
});
test('same idempotency key cannot be used for another cart', async () => {
  const f = fixture(); await f.pay();
  await assert.rejects(f.pay({ ...f.body, items: [{ id: 8, qty: 1 }] }), /another cart/);
  assert.equal(f.state().entries.length, 1);
});
test('wallet cancellation refunds once, including concurrent retries', async () => {
  const f = fixture(); const order = await f.pay();
  await Promise.all([f.transaction(t => f.wallet.refund(order, t)), f.transaction(t => f.wallet.refund(order, t))]);
  assert.equal(f.state().balance, 30000);
  assert.equal(f.state().entries.filter(e => e.source === 'refund').length, 1);
  assert.equal(f.state().payments[0].status, 'refunded');
});
test('invalid totals cannot debit a wallet', async () => {
  for (const total of [0, -2, Infinity, NaN]) {
    const f = fixture(); await assert.rejects(f.pay(f.body, total), /Invalid order total/);
    assert.equal(f.state().balance, 30000);
  }
});
test('missing checkout request ID is rejected', async () => {
  const f = fixture(); await assert.rejects(f.pay({ ...f.body, request_id: '' }), /request ID/);
});
