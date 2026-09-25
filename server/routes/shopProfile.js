const express = require('express');
const router = express.Router();
const { getShopProfile, updateShopProfile } = require('../db/database');

/**
 * GET /api/shop-profile
 * Retrieve current Shop & Pharmacist profile details
 */
router.get('/', (req, res) => {
  try {
    const profile = getShopProfile();
    res.json(profile);
  } catch (err) {
    console.error('Get shop profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve shop profile' });
  }
});

/**
 * POST /api/shop-profile
 * Update Shop & Pharmacist profile details
 */
router.post('/', (req, res) => {
  try {
    const {
      shop_name,
      license_20b,
      license_21b,
      shop_license_validity,
      shop_phone,
      pharmacist_name,
      pharmacist_phone,
      pharmacist_license_validity,
    } = req.body;

    const updated = updateShopProfile({
      shop_name,
      license_20b,
      license_21b,
      shop_license_validity,
      shop_phone,
      pharmacist_name,
      pharmacist_phone,
      pharmacist_license_validity,
    });

    res.json({
      success: true,
      message: 'Shop profile updated successfully',
      profile: updated,
    });
  } catch (err) {
    console.error('Update shop profile error:', err);
    res.status(500).json({ error: err.message || 'Failed to update shop profile' });
  }
});

module.exports = router;
