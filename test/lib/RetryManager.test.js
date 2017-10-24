'use strict';

// ------- Imports -------------------------------------------------------------

const test = require('ava');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const BlinkRetryError = require('../../src/errors/BlinkRetryError');
const RetryManager = require('../../src/lib/RetryManager');
const DelayLogic = require('../../src/lib/DelayLogic');
const HooksHelper = require('../helpers/HooksHelper');
const MessageFactoryHelper = require('../helpers/MessageFactoryHelper');

// ------- Init ----------------------------------------------------------------

chai.should();
chai.use(sinonChai);

// Setup blink app for each test.
test.beforeEach(HooksHelper.createRandomQueueInMemory);
test.afterEach.always(HooksHelper.destroyRandomQueueInMemory);

// ------- Tests ---------------------------------------------------------------

/**
 * RetryManager: constructor()
 */
test('RetryManager: Test class interface', (t) => {
  const retryManager = new RetryManager(t.context.queue);
  retryManager.should.respondTo('retry');
  retryManager.should.respondTo('retryNumberToDelayMs');
  retryManager.should.respondTo('republishWithDelay');
  retryManager.should.respondTo('log');
  retryManager.should.have.property('retryLimit');
  // Ensure default retry delay logic is DelayLogic.exponentialBackoff
  retryManager.retryNumberToDelayMs.should.be.equal(DelayLogic.exponentialBackoff);

  // Ensure it's possible to override DelayLogic
  const customDelayLogic = currentRetryNumber => currentRetryNumber;
  const retryManagerCustom = new RetryManager(t.context.queue, customDelayLogic);
  retryManagerCustom.should.respondTo('retryNumberToDelayMs');
  retryManagerCustom.retryNumberToDelayMs.should.be.equal(customDelayLogic);
});

/**
 * RetryManager.retry()
 */
test('RetryManager.retry(): ensure nack when retry limit is reached', async (t) => {
  const queue = t.context.queue;
  // Stub queue method to ensure nack() will be called.
  const ackStub = sinon.stub(queue, 'ack').returns(null);
  const nackStub = sinon.stub(queue, 'nack').returns(null);

  // Create retryManager.
  const retryManager = new RetryManager(queue);

  // Prepare retry message for the manager.
  const message = MessageFactoryHelper.getRandomMessage();
  const retryError = new BlinkRetryError('Testing BlinkRetryError', message);
  // Set current retry attempt to the limit set in the manager + 1.
  message.payload.meta.retryAttempt = retryManager.retryLimit + 1;

  // Pass the message to retry().
  const result = await retryManager.retry(message, retryError);
  result.should.be.false;

  // Make sure the message has been nacked.
  ackStub.should.not.have.been.called;
  nackStub.should.have.been.calledWith(message);

  // Cleanup.
  ackStub.restore();
  nackStub.restore();
});

/**
 * RetryManager.retry()
 */
test('RetryManager.retry(): should call republishWithDelay with correct params', async (t) => {
  const queue = t.context.queue;

  // Create retryManager.
  const retryManager = new RetryManager(queue);

  // Prepare retry message for the manager.
  const message = MessageFactoryHelper.getRandomMessage();
  const retryError = new BlinkRetryError('Testing BlinkRetryError', message);
  // Set current retry attempt to the limit set in the manager - 1.
  const retryAttempt = retryManager.retryLimit - 1;
  message.payload.meta.retryAttempt = retryManager.retryLimit - 1;

  // Stub republishWithDelay.
  const republishWithDelayStub = sinon.stub(retryManager, 'republishWithDelay');
  republishWithDelayStub.resolves(null);

  // Pass the message to retry().
  const result = await retryManager.retry(message, retryError);
  result.should.be.true;

  republishWithDelayStub.should.have.been.calledWith(
    DelayLogic.exponentialBackoff(retryAttempt),
    message,
  );

  // Ensure message has correct retryAttempt setting.
  message.getMeta().retryAttempt.should.equal(retryAttempt);

  // Cleanup.
  republishWithDelayStub.restore();
});

// ------- End -----------------------------------------------------------------
