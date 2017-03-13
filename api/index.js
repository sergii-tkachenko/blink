'use strict';

/**
 * Imports.
 */
const express = require('express');

/**
 * Dependencies initializations.
 */
const router = express.Router();

/**
 * Routing.
 */
// API Root
router.get('/', (req, res) => {
  res.json({
    v1: '/api/v1',
  });
});

// API Version 1
router.use('/v1', require('./v1'));

module.exports = router;
