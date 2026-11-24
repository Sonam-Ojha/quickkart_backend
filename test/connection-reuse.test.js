const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const nonOverlappingTask = require('../src/services/non-overlapping-task');

test('DB configuration keeps the singleton pool warm without opening a database connection', () => {
  let instances = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/config/db.js'), 'utf8'), {
    module,
    process: { env: { DB_NAME: 'test_placeholder', DB_USER: 'test_placeholder', DB_PASSWORD: 'test_placeholder', DB_HOST: 'test.invalid' } },
    require(name) {
      assert.equal(name, 'sequelize');
      return { Sequelize: class {
        constructor(_name, _user, _password, options) { instances++; this.options = options; }
      } };
    },
  });
  const config = module.exports.options;
  assert.equal(instances, 1);
  assert.equal(config.pool.max, 5);
  assert.equal(config.pool.min, 1);
  assert.equal(config.pool.idle, 300000);
  assert.equal(config.pool.evict, 30000);
  assert.equal(config.pool.acquire, 10000);
  assert.equal(config.dialectOptions.enableKeepAlive, true);
});

test('slow jobs skip overlapping ticks but run again after completion', async () => {
  let resolve, calls = 0;
  const pending = new Promise(r => { resolve = r; });
  const run = nonOverlappingTask(async () => { calls++; await pending; return 'done'; });
  const first = run();
  assert.equal(await run(), undefined);
  assert.equal(calls, 1);
  resolve();
  assert.equal(await first, 'done');
  assert.equal(await run(), 'done');
  assert.equal(calls, 2);
});

test('failed or synchronously throwing jobs release the guard for the next tick', async () => {
  let calls = 0;
  const run = nonOverlappingTask(() => { if (++calls === 1) throw Error('Simulated failure'); return 7; });
  await assert.rejects(run(), /Simulated failure/);
  assert.equal(await run(), 7);
});

test('independent background jobs do not block one another', async () => {
  let resolve;
  const blocked = nonOverlappingTask(() => new Promise(r => { resolve = r; }));
  const independent = nonOverlappingTask(async () => 9);
  const pending = blocked();
  assert.equal(await independent(), 9);
  resolve();
  await pending;
});


test('connection hooks count physical opens and lifetime without issuing queries or exposing credentials', () => {
  const module = { exports: {} }, entries = [];
  let now = 1000;
  class FakeDate extends Date { static now() { return now; } }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/config/db.js'), 'utf8'), {
    module, Date: FakeDate,
    console: { info: (...args) => entries.push(args.join(' ')) },
    process: { pid: 42, env: { DB_NAME: 'test_name', DB_USER: 'test_user', DB_PASSWORD: 'test_secret', DB_HOST: 'test.invalid' } },
    require(name) {
      assert.equal(name, 'sequelize');
      return { Sequelize: class { constructor(_name, _user, _password, options) { this.options = options; } } };
    },
  });
  const hooks = module.exports.options.hooks;
  const first = {}, second = {};
  hooks.afterConnect(first);
  now += 20000;
  hooks.afterConnect(second);
  hooks.afterDisconnect(first);
  const messages = entries.map(entry => JSON.parse(entry.slice('[db-connection] '.length)));
  assert.equal(messages[1].last60Minutes, 2);
  assert.equal(messages[1].totalSinceBoot, 2);
  assert.equal(messages[2].lifetimeMs, 20000);
  assert.equal(messages[0].pid, 42);
  now += 3600001;
  hooks.afterConnect({});
  const latest = JSON.parse(entries.at(-1).slice('[db-connection] '.length));
  assert.equal(latest.last60Minutes, 1);
  assert.equal(latest.totalSinceBoot, 3);
  assert.ok(entries.every(entry => !/test_name|test_user|test_secret|test.invalid/.test(entry)));
});
