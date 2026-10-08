const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Live push to the apps over Socket.IO. Each socket joins one room from its
// JWT — `rider:<id>` or `user:<id>` — so events go only to whoever they're for.
// Polling stays in the apps as a fallback; these events just make it instant.
//
// Events
//   rider  ← offer:new   { orderId }            new order offered to this rider
//   rider  ← offer:gone  { orderId }            someone else took it / it lapsed
//   both   ← order:update { orderId, status, riderStage }
//   user   ← rider:location { orderId, lat, lng }

let io = null;

const SECRET = () => process.env.JWT_SECRET || 'my-secret-key';

const init = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const raw = socket.handshake.auth?.token || socket.handshake.query?.token || '';
    try {
      const payload = jwt.verify(String(raw).replace(/^Bearer\s+/i, ''), SECRET());
      if (payload.role === 'rider') socket.data.room = `rider:${payload.id}`;
      else if (payload.role === 'user') socket.data.room = `user:${payload.id}`;
      else return next(new Error('unsupported role'));
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.room);
    console.log(`[realtime] ${socket.data.room} connected`);
    socket.on('disconnect', () => console.log(`[realtime] ${socket.data.room} disconnected`));
  });
  console.log('[realtime] socket.io ready');
  return io;
};

const emit = (room, event, data) => { if (io) io.to(room).emit(event, data); };
const toRider = (riderId, event, data) => emit(`rider:${riderId}`, event, data);
const toUser  = (userId, event, data)  => emit(`user:${userId}`, event, data);

// One call for "this order changed" — tells the customer and the assigned rider.
const orderChanged = (order) => {
  if (!order) return;
  const data = { orderId: order.id, status: order.status, riderStage: order.riderStage ?? null };
  if (order.customerId) toUser(order.customerId, 'order:update', data);
  if (order.riderId) toRider(order.riderId, 'order:update', data);
};

module.exports = { init, toRider, toUser, orderChanged };
