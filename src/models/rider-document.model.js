const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// KYC uploads from the registration flow. The per-document status here is the
// source of truth; riders.kyc_*_status is the cached roll-up the profile
// screen reads without a join.
const RiderDocument = sequelize.define('RiderDocument', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riderId:         { type: DataTypes.INTEGER, allowNull: false, field: 'rider_id', references: { model: 'riders', key: 'id' } },
  docType:         { type: DataTypes.ENUM('aadhaar','pan','license','rc','bank_proof','photo'), allowNull: false, field: 'doc_type' },
  // Absolute URL built with PUBLIC_URL, same as the admin upload route.
  fileUrl:         { type: DataTypes.STRING(255), allowNull: false, field: 'file_url' },
  status:          { type: DataTypes.ENUM('uploaded','verified','rejected'), defaultValue: 'uploaded' },
  rejectionReason: { type: DataTypes.STRING(255), allowNull: true, field: 'rejection_reason' },
  reviewedAt:      { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
}, {
  tableName: 'rider_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['rider_id', 'doc_type'] }],
});

const Rider = require('./rider.model');
RiderDocument.belongsTo(Rider, { foreignKey: 'riderId', as: 'rider' });
Rider.hasMany(RiderDocument,   { foreignKey: 'riderId', as: 'documents' });

module.exports = RiderDocument;
