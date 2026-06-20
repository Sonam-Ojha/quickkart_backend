const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupportMessage = sequelize.define('SupportMessage', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticketId:   { type: DataTypes.INTEGER, allowNull: false, field: 'ticket_id', references: { model: 'support_tickets', key: 'id' } },
  senderType: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, field: 'sender_type' },
  senderId:   { type: DataTypes.INTEGER, allowNull: false, field: 'sender_id' },
  message:    { type: DataTypes.TEXT, allowNull: false },
  createdAt:  { type: DataTypes.DATE, field: 'created_at' },
}, {
  tableName: 'support_messages',
  timestamps: false,
});

const SupportTicket = require('./support-ticket.model');
SupportTicket.hasMany(SupportMessage, { foreignKey: 'ticketId', as: 'messages' });
SupportMessage.belongsTo(SupportTicket, { foreignKey: 'ticketId' });

module.exports = SupportMessage;
