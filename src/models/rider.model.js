const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Rider = sequelize.define('Rider', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:             { type: DataTypes.STRING(100), allowNull: false },
  mobile:           { type: DataTypes.STRING(15), allowNull: false, unique: true },
  password:         { type: DataTypes.STRING(255), allowNull: true },
  vehicleType:      { type: DataTypes.ENUM('bike', 'scooter', 'cycle', 'other', 'ebike', 'bicycle'), defaultValue: 'bike', field: 'vehicle_type' },
  vehicleNumber:    { type: DataTypes.STRING(20), allowNull: true, field: 'vehicle_number' },
  isOnline:         { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_online' },
  storeId:          { type: DataTypes.INTEGER, allowNull: false, field: 'store_id', references: { model: 'dark_stores', key: 'id' } },
  rating:           { type: DataTypes.DECIMAL(3, 2), defaultValue: 5.00 },
  totalDeliveries:  { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_deliveries' },
  totalEarnings:    { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_earnings' },
  status:           { type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending_verification'), defaultValue: 'active' },

  // ── Profile extras (rider app) ──────────────────────────
  photoUrl:         { type: DataTypes.STRING(255), allowNull: true, field: 'photo_url' },
  languageCode:     { type: DataTypes.STRING(5), defaultValue: 'en', field: 'language_code' },

  // ── Live location (updated by POST /api/rider/location) ─
  latitude:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  lastLocationAt:   { type: DataTypes.DATE, allowNull: true, field: 'last_location_at' },

  // ── KYC roll-up (per-document rows live in rider_documents) ─
  kycAadhaarStatus: { type: DataTypes.ENUM('not_uploaded','uploaded','verified','rejected'), defaultValue: 'not_uploaded', field: 'kyc_aadhaar_status' },
  kycPanStatus:     { type: DataTypes.ENUM('not_uploaded','uploaded','verified','rejected'), defaultValue: 'not_uploaded', field: 'kyc_pan_status' },
  kycLicenseStatus: { type: DataTypes.ENUM('not_uploaded','uploaded','verified','rejected'), defaultValue: 'not_uploaded', field: 'kyc_license_status' },
  kycBankStatus:    { type: DataTypes.ENUM('not_uploaded','uploaded','verified','rejected'), defaultValue: 'not_uploaded', field: 'kyc_bank_status' },

  // ── Payout destination (one per rider in v1) ────────────
  bankAccountName:  { type: DataTypes.STRING(100), allowNull: true, field: 'bank_account_name' },
  bankAccountNo:    { type: DataTypes.STRING(30),  allowNull: true, field: 'bank_account_no' },
  bankIfsc:         { type: DataTypes.STRING(15),  allowNull: true, field: 'bank_ifsc' },
  upiId:            { type: DataTypes.STRING(60),  allowNull: true, field: 'upi_id' },

  // ── Dispatch counters — acceptance / completion rates ───
  offeredCount:     { type: DataTypes.INTEGER, defaultValue: 0, field: 'offered_count' },
  acceptedCount:    { type: DataTypes.INTEGER, defaultValue: 0, field: 'accepted_count' },
  rejectedCount:    { type: DataTypes.INTEGER, defaultValue: 0, field: 'rejected_count' },
  cancelledCount:   { type: DataTypes.INTEGER, defaultValue: 0, field: 'cancelled_count' },
}, {
  tableName: 'riders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const DarkStore = require('./darkstore.model');
Rider.belongsTo(DarkStore, { foreignKey: 'storeId', as: 'store' });
DarkStore.hasMany(Rider, { foreignKey: 'storeId', as: 'riders' });

module.exports = Rider;
