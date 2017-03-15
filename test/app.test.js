'use strict';

/**
 * Imports.
 */
const test = require('ava');
const supertest = require('supertest');
require('chai').should();
const app = require('../app');

/**
 * Test root.
 */
test('GET / should be polite', async () => {
  const res = await supertest(app).get('/');
  res.status.should.be.equal(200);
  res.text.should.be.equal('Hi, I\'m Blink!');
});
