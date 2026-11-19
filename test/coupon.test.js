const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const DAY = 24 * 60 * 60 * 1000;

// Loads coupon.service with in-memory Coupon / CouponUsage models.
function setup(coupons, usage = []) {
  const Op = { like: 'like', in: 'in', lte: 'lte', gte: 'gte', gt: 'gt' };
  const rows = coupons.map((c, i) => ({
    id: i + 1, usedCount: 0, perUserLimit: 1, usageLimit: null, maxDiscount: null, minOrder: 0, isActive: true,
    validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + DAY),
    ...c,
    async increment(field) { this[field] += 1; },
  }));
  const Coupon = {
    findOne: async ({ where }) => rows.find(r => r.code === where.code && r.isActive === where.isActive) ?? null,
    findAll: async () => rows.filter(r => r.isActive && r.validFrom <= new Date() && r.validTo >= new Date()),
    decrement: async (field, { where }) => { const r = rows.find(x => x.id === where.id); if (r && r[field] > 0) r[field] -= 1; },
  };
  const CouponUsage = {
    count: async ({ where }) => usage.filter(u => u.couponId === where.couponId && u.userId === where.userId).length,
    create: async (u) => {
      const row = { ...u, destroy: async () => usage.splice(usage.indexOf(row), 1) };
      usage.push(row);
    },
    findOne: async ({ where }) => usage.find(u => u.orderId === where.orderId) ?? null,
    findAll: async ({ where }) => {
      const counts = {};
      for (const u of usage) if (u.userId === where.userId) counts[u.couponId] = (counts[u.couponId] ?? 0) + 1;
      return Object.entries(counts).map(([couponId, used]) => ({ couponId: Number(couponId), used }));
    },
  };
  const module = { exports: {} };
  const file = 'src/services/coupon.service.js';
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, console,
    require(name) {
      if (name === 'sequelize') return { Op, fn: () => null, col: () => null };
      if (name === '../models/coupon.model') return Coupon;
      if (name === '../models/coupon-usage.model') return CouponUsage;
      throw Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: file });
  return { service: module.exports, rows, usage };
}

// Money on coupons is paise: ₹50 = 5000.
const flat50  = { code: 'FLAT50', type: 'flat', value: 5000, minOrder: 19900 };
const pct10   = { code: 'SAVE10', type: 'percent', value: 10, maxDiscount: 3000 };

test('flat coupon gives its rupee value once the minimum order is met', async () => {
  const { service } = setup([flat50]);
  const { discount } = await service.evaluate({ code: ' flat50 ', userId: 1, subtotal: 250 });
  assert.equal(discount, 50);
  await assert.rejects(service.evaluate({ code: 'FLAT50', userId: 1, subtotal: 150 }), /₹49 more.*₹199/);
});

test('percent coupon is capped at its max discount', async () => {
  const { service } = setup([pct10]);
  assert.equal((await service.evaluate({ code: 'SAVE10', userId: 1, subtotal: 200 })).discount, 20);
  assert.equal((await service.evaluate({ code: 'SAVE10', userId: 1, subtotal: 1000 })).discount, 30);
});

test('discount never exceeds the subtotal', async () => {
  const { service } = setup([{ code: 'BIG', type: 'flat', value: 50000 }]);
  assert.equal((await service.evaluate({ code: 'BIG', userId: 1, subtotal: 120 })).discount, 120);
});

test('unknown, inactive, expired and not-yet-active coupons are rejected', async () => {
  const { service } = setup([
    { code: 'OFF', type: 'flat', value: 1000, isActive: false },
    { code: 'OLD', type: 'flat', value: 1000, validTo: new Date(Date.now() - 1000) },
    { code: 'SOON', type: 'flat', value: 1000, validFrom: new Date(Date.now() + DAY) },
  ]);
  await assert.rejects(service.evaluate({ code: 'NOPE', userId: 1, subtotal: 500 }), /Invalid coupon/);
  await assert.rejects(service.evaluate({ code: 'OFF', userId: 1, subtotal: 500 }), /Invalid coupon/);
  await assert.rejects(service.evaluate({ code: 'OLD', userId: 1, subtotal: 500 }), /expired/);
  await assert.rejects(service.evaluate({ code: 'SOON', userId: 1, subtotal: 500 }), /not active yet/);
  await assert.rejects(service.evaluate({ code: '  ', userId: 1, subtotal: 500 }), /enter a coupon/);
});

test('per-user and total usage limits are enforced, and cancelling an order frees the coupon', async () => {
  const { service, rows } = setup([{ ...pct10, usageLimit: 2 }]);
  const first = await service.evaluate({ code: 'SAVE10', userId: 1, subtotal: 200 });
  await service.recordUsage({ coupon: first.coupon, userId: 1, orderId: 100, discount: first.discount });
  await assert.rejects(service.evaluate({ code: 'SAVE10', userId: 1, subtotal: 200 }), /already used/);

  const second = await service.evaluate({ code: 'SAVE10', userId: 2, subtotal: 200 });
  await service.recordUsage({ coupon: second.coupon, userId: 2, orderId: 101, discount: second.discount });
  await assert.rejects(service.evaluate({ code: 'SAVE10', userId: 3, subtotal: 200 }), /usage limit/);

  await service.releaseForOrder(100);
  assert.equal(rows[0].usedCount, 1);
  assert.equal((await service.evaluate({ code: 'SAVE10', userId: 1, subtotal: 200 })).discount, 20);
});

test('customer list shows rupee amounts and hides coupons the customer used up', async () => {
  const { service } = setup([flat50, pct10], [{ couponId: 2, userId: 1, orderId: 5 }]);
  const mine = await service.listForCustomer(1);
  assert.deepEqual(mine.map(c => c.code), ['FLAT50']);
  assert.equal(mine[0].value, 50);
  assert.equal(mine[0].minOrder, 199);
  const other = await service.listForCustomer(2);
  assert.deepEqual(other.map(c => [c.code, c.value, c.maxDiscount]), [['FLAT50', 50, null], ['SAVE10', 10, 30]]);
});
