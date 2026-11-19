const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');

function load(file, dependencies, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, console, process: { env }, Buffer,
    require(name) { if (name in dependencies) return dependencies[name]; throw Error(`Unexpected dependency: ${name}`); },
  }, { filename: file });
  return module.exports;
}
const env = { RAZORPAY_KEY_ID: 'test_key', RAZORPAY_KEY_SECRET: 'local_test_secret' };
const body = { items: [{ product_id: 7, qty: 2 }], lat: 28.6, lng: 77.2 };
function setup() {
  let order, payment;
  const gateway = {
    orders: {
      create: async options => (order = { ...options, id: 'order_mock' }),
      fetch: async () => order,
    },
    payments: { fetch: async () => payment },
  };
  const service = load('src/services/checkout-payment.service.js', {
    crypto, razorpay: class { constructor() { return gateway; } },
  }, env);
  return { service, async paid(kind = 'grocery') {
    await service.createPayment(3, body, kind, 205);
    payment = { order_id: 'order_mock', amount: 20500, currency: 'INR', status: 'captured' };
    return { ...body, razorpay_order_id: 'order_mock', razorpay_payment_id: 'pay_mock',
      razorpay_signature: crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update('order_mock|pay_mock').digest('hex') };
  }, changePayment(changes) { Object.assign(payment, changes); } };
}
const res = () => ({ code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } });

test('quantities must be positive integers; duplicate quantities are merged and bounded', () => {
  const { service } = setup();
  for (const qty of [0, -1, 1.5, 51, 'bad']) assert.throws(() => service.normalizeItems([{ id: 1, qty }]));
  assert.throws(() => service.normalizeItems([{ id: 1, qty: 30 }, { id: 1, qty: 30 }]));
  const normalized = service.normalizeItems([{ id: '7', qty: 1 }, { product_id: 7, qty: 2 }]);
  assert.equal(normalized.length, 1); assert.equal(normalized[0].qty, 3);
});

test('captured payment with correct signature, customer, cart and amount passes', async () => {
  const { service, paid } = setup();
  const result = await service.verifyPayment(3, await paid(), 'grocery');
  assert.equal(result.id, 'pay_mock'); assert.equal(result.amount, 20500);
});

test('coupon is part of the cart fingerprint; carts without one hash as before', () => {
  const { service } = setup();
  const plain = service.fingerprint(body, 'grocery');
  assert.equal(service.fingerprint({ ...body, coupon_code: '' }, 'grocery'), plain);
  const withCoupon = service.fingerprint({ ...body, coupon_code: 'save50' }, 'grocery');
  assert.notEqual(withCoupon, plain);
  assert.equal(service.fingerprint({ ...body, coupon_code: ' SAVE50 ' }, 'grocery'), withCoupon);
  assert.notEqual(service.fingerprint({ ...body, coupon_code: 'OTHER' }, 'grocery'), withCoupon);
});

test('rejects wrong signatures and malformed signatures', async () => {
  const { service, paid } = setup(); const request = await paid();
  for (const signature of ['invalid', '0'.repeat(64), null])
    await assert.rejects(service.verifyPayment(3, { ...request, razorpay_signature: signature }, 'grocery'), /signature/);
});

test('rejects another customer, changed cart, location and checkout kind', async () => {
  const { service, paid } = setup(); const request = await paid();
  await assert.rejects(service.verifyPayment(4, request, 'grocery'), /customer or cart/);
  await assert.rejects(service.verifyPayment(3, { ...request, items: [{ id: 7, qty: 3 }] }, 'grocery'), /customer or cart/);
  await assert.rejects(service.verifyPayment(3, { ...request, lat: 29 }, 'grocery'), /customer or cart/);
  await assert.rejects(service.verifyPayment(3, request, 'food'), /customer or cart/);
});

test('rejects wrong amount, currency, gateway order or uncaptured payment', async () => {
  for (const changes of [{ amount: 1 }, { currency: 'USD' }, { order_id: 'other' }, { status: 'authorized' }, { status: 'failed' }]) {
    const fixture = setup(); const request = await fixture.paid(); fixture.changePayment(changes);
    await assert.rejects(fixture.service.verifyPayment(3, request, 'grocery'));
  }
});

test('missing configuration fails closed', async () => {
  const service = load('src/services/checkout-payment.service.js', { crypto, razorpay: class {} });
  await assert.rejects(service.createPayment(3, body, 'grocery', 205), /not configured/);
  await assert.rejects(service.verifyPayment(3, body, 'grocery'), /not configured/);
});

function groceryRoute({ invalid = false, prior = false, price = 10000 } = {}) {
  const handlers = {}; let transactions = 0, commits = 0, rollbacks = 0, created = 0;
  let storedPayment = prior;
  let mutex = Promise.resolve();
  const existing = { id: 10, customerId: 3, toJSON: () => ({ id: 10, customerId: 3 }) };
  function transaction() {
    let release;
    return {
      LOCK: { UPDATE: 'UPDATE' },
      async lock() {
        const previous = mutex;
        mutex = new Promise(resolve => { release = resolve; });
        await previous;
      },
      async commit() { commits++; this.finished = 'commit'; release?.(); },
      async rollback() { rollbacks++; this.finished = 'rollback'; release?.(); },
    };
  }

  const dependencies = {
    express: { Router: () => ({ use() {}, post(route, handler) { handlers[route] = handler; } }) }, crypto,
    sequelize: { Op: { in: 'in' } },
    '../../services/checkout-payment.service': {
      verifyPayment: async () => { if (invalid) throw Object.assign(Error('Invalid signature'), { status: 400 }); return { id: 'pay_mock', amount: 20500 }; },
      normalizeItems: () => [{ id: 7, product_id: 7, qty: 2 }], fail: (message, status) => Object.assign(Error(message), { status }),
    },
    '../../../src/config/db': { transaction: async () => { transactions++; return transaction(); } },
    '../../models/user.model': { findByPk: async (_, options) => { if (options.transaction) { assert.equal(options.lock, 'UPDATE'); await options.transaction.lock(); } return { id: 3 }; } },
    '../../models/payment.model': { findOne: async () => storedPayment ? { orderId: 10 } : null, create: async () => { created++; storedPayment = true; } },
    '../../models/order.model': { findByPk: async () => existing, create: async () => existing },
    '../../models/product.model': { findAll: async () => [{ id: 7, price }] },
    '../../models/inventory.model': { findOne: async () => ({ stockQty: 50 }), decrement: async () => {} },
    '../../models/order-item.model': { bulkCreate: async () => {} },
    '../../models/order-timeline.model': { create: async () => {} },
    '../../models/darkstore.model': {}, '../../models/address.model': {},
    '../../services/storefront.service': { storeForDelivery: async () => ({ store: { id: 1 } }) },
    '../../services/otp.service': {}, '../../middlewares/customer.middleware': {},
    '../../services/rider-dispatch.service': { offerOrder: async () => {} },
    '../../services/coupon.service': {
      normalizeCode: code => (typeof code === 'string' ? code.trim().toUpperCase() : ''),
      evaluate: async () => { throw Error('coupon not expected in this test'); },
      recordUsage: async () => {},
    },
  };
  load('src/routes/app/payment.routes.js', dependencies);
  return { create: handlers['/razorpay/create'], verify: handlers['/razorpay/verify'], stats: () => ({ transactions, commits, rollbacks, created }) };
}

test('invalid signature never opens a database transaction', async () => {
  const fixture = groceryRoute({ invalid: true }), response = res();
  await fixture.verify({ body, user: { id: 3 } }, response);
  assert.equal(response.code, 400); assert.equal(fixture.stats().transactions, 0);
});

test('retry returns existing order without creating payment or deducting inventory', async () => {
  const fixture = groceryRoute({ prior: true }), response = res();
  await fixture.verify({ body, user: { id: 3 } }, response);
  assert.equal(response.code, 200); assert.equal(response.data.id, 10);
  assert.equal(fixture.stats().commits, 1); assert.equal(fixture.stats().created, 0);
});

test('successful confirmation commits once', async () => {
  const fixture = groceryRoute(), response = res();
  await fixture.verify({ body, user: { id: 3 } }, response);
  assert.equal(response.code, 201); assert.equal(fixture.stats().created, 1); assert.equal(fixture.stats().commits, 1);
});

test('wallet uses model attributes and preserves paise; missing users return 404', async () => {
  let found = true;
  const controller = load('src/controllers/app/wallet.controller.js', {
    '../../models/user.model': { findByPk: async (_, options) => { assert.ok(options.attributes.includes('walletBalance')); return found ? { walletBalance: 12345 } : null; } },
    '../../models/wallet-transaction.model': { findAll: async options => { assert.equal(options.where.userId, 3); return []; } },
  });
  const response = res(); await controller.getBalance({ user: { id: 3 } }, response); assert.equal(response.data.balance, 12345);
  found = false; const missing = res(); await controller.getBalance({ user: { id: 3 } }, missing); assert.equal(missing.code, 404);
});

test('grocery COD endpoint rejects client claims of paid online payment before opening transaction', async () => {
  const deps = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers/app/orders.controller.js'), 'utf8');
  for (const [, name] of source.matchAll(/require\('([^']+)'\)/g)) deps[name] = {};
  deps['../../services/checkout-payment.service'] = setup().service;
  let transactions = 0;
  deps['../../../src/config/db'] = { transaction: async () => { transactions++; } };
  const ctrl = load('src/controllers/app/orders.controller.js', deps);
  for (const method of ['razorpay', 'made_up']) {
    const response = res(); await ctrl.place({ body: { ...body, payment_method: method }, user: { id: 3 } }, response);
    assert.equal(response.code, 400);
  }
  assert.equal(transactions, 0);
});

test('food service rejects unverified paid claims before reading database', async () => {
  const deps = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/services/food-order.service.js'), 'utf8');
  for (const [, name] of source.matchAll(/require\('([^']+)'\)/g)) deps[name] = {};
  deps.crypto = crypto;
  deps['./checkout-payment.service'] = setup().service;
  const svc = load('src/services/food-order.service.js', deps);
  await assert.rejects(svc.placeFoodOrder(3, { payment_method: 'razorpay' }), /verified online checkout/);
});

test('food quote rejects closed restaurant before gateway payment can be created', async () => {
  const deps = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/services/food-order.service.js'), 'utf8');
  for (const [, name] of source.matchAll(/require\('([^']+)'\)/g)) deps[name] = {};
  deps.crypto = crypto;
  deps['./checkout-payment.service'] = setup().service;
  deps['../models/restaurant.model'] = { findOne: async () => ({ id: 8, storeId: 1, name: 'Cafe' }) };
  deps['../models/darkstore.model'] = { findByPk: async () => ({ isActive: true, foodEnabled: true }) };
  deps['./food.service'] = { isOpenNow: () => false };
  const svc = load('src/services/food-order.service.js', deps);
  await assert.rejects(svc.quoteFoodOrder(3, { restaurant_id: 8, items: [{ id: 1, qty: 1 }] }), /closed/);
});

test('two concurrent confirmations serialize and create only one order/payment', async () => {
  const fixture = groceryRoute(), first = res(), second = res();
  await Promise.all([
    fixture.verify({ body, user: { id: 3 } }, first),
    fixture.verify({ body, user: { id: 3 } }, second),
  ]);
  assert.equal(first.data.id, second.data.id);
  assert.equal(fixture.stats().created, 1);
  assert.equal(fixture.stats().commits, 2);
});

test('post-payment price mismatch rolls back without creating an order/payment', async () => {
  const fixture = groceryRoute({ price: 20000 }), response = res();
  await fixture.verify({ body, user: { id: 3 } }, response);
  assert.equal(response.code, 409);
  assert.equal(fixture.stats().rollbacks, 1);
  assert.equal(fixture.stats().created, 0);
});

test('food paid order records gateway transaction inside the verification transaction', async () => {
  const deps = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/services/food-order.service.js'), 'utf8');
  for (const [, name] of source.matchAll(/require\('([^']+)'\)/g)) deps[name] = {};
  let payment, callbacks = [];
  const transaction = { afterCommit(fn) { callbacks.push(fn); } };
  deps.crypto = crypto;
  deps.sequelize = { Op: { in: 'in' } };
  deps['./checkout-payment.service'] = setup().service;
  deps['../models/restaurant.model'] = { findOne: async () => ({ id: 8, storeId: 1, name: 'Cafe' }) };
  deps['../models/darkstore.model'] = { findByPk: async () => ({ isActive: true, foodEnabled: true }) };
  deps['./food.service'] = { isOpenNow: () => true };
  deps['./darkstore.service'] = { findNearestStore: async () => ({ store: { id: 1 } }) };
  deps['../models/menu-item.model'] = { findAll: async () => [{ id: 7, price: 100, name: 'Dish', isAvailable: true }] };
  deps['../models/order.model'] = { create: async (_, options) => { assert.equal(options.transaction, transaction); return { id: 10, toJSON: () => ({ id: 10 }) }; } };
  deps['../models/order-item.model'] = { bulkCreate: async () => {} };
  deps['../models/order-timeline.model'] = { create: async () => {} };
  deps['../models/payment.model'] = { create: async (data, options) => { assert.equal(options.transaction, transaction); payment = data; } };
  const svc = load('src/services/food-order.service.js', deps);
  await svc.placeFoodOrder(3, { ...body, items: [{ menu_item_id: 7, qty: 2 }], restaurant_id: 8, payment_method: 'razorpay' }, { transaction, paymentId: 'pay_food', paidAmount: 20500 });
  assert.equal(payment.txnId, 'pay_food'); assert.equal(payment.status, 'paid');
  assert.equal(callbacks.length, 1);
});

test('amount-only old app requests receive an update instruction without creating payment', async () => {
  const fixture = groceryRoute(), response = res();
  await fixture.create({ body: { amount: 215, lat: 28.6, lng: 77.2 }, user: { id: 3 } }, response);
  assert.equal(response.code, 426);
  assert.equal(response.data.code, 'APP_UPDATE_REQUIRED');
  assert.match(response.data.message, /Play Store/);
  assert.equal(fixture.stats().transactions, 0);
});
