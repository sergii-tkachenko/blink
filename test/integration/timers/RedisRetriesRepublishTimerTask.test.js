'use strict';

// ------- Imports -------------------------------------------------------------

const test = require('ava');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const BlinkApp = require('../../../src/app/BlinkApp');
const BlinkRetryError = require('../../../src/errors/BlinkRetryError');
const Queue = require('../../../src/lib/Queue');
const FreeFormMessage = require('../../../src/messages/FreeFormMessage');
const RedisRetriesRepublishTimerTask = require('../../../src/timers/RedisRetriesRepublishTimerTask');
const Worker = require('../../../src/workers/Worker');
const HooksHelper = require('../../helpers/HooksHelper');
const MessageFactoryHelper = require('../../helpers/MessageFactoryHelper');

// ------- Init ----------------------------------------------------------------

chai.should();
chai.use(sinonChai);

// const chance = new Chance();

// ------- Tests ---------------------------------------------------------------

test('RedisRetriesRepublishTimerTask Test full message cycle. ', async (t) => {
  // ***************************************************************************
  // 0. Setup dependecies
  await HooksHelper.startBlinkWebApp(t);
  const blink = t.context.blink;
  const sandbox = sinon.createSandbox();

  // Create test queue and register it in Blink app.
  class RetryTestQ extends Queue {
    constructor(...args) {
      super(...args);
      this.messageClass = FreeFormMessage;
    }
  }
  const retryTestQ = new RetryTestQ(blink.broker);
  const ackSpy = sandbox.spy(retryTestQ, 'ack');
  await retryTestQ.create();
  const registryName = BlinkApp.generateQueueRegistryKey(RetryTestQ);
  blink.queues[registryName] = retryTestQ;

  // Purge the queue in case it existed.
  await retryTestQ.purge();

  // Retry worker test class.
  class RetryTestWorker extends Worker {
    /* eslint-disable no-unused-vars, class-methods-use-this, no-empty-function */
    setup() {
      super.setup({ queue: this.blink.queues.retryTestQ });
    }
    async consume() {}
    /* eslint-enable */
  }

  // ***************************************************************************
  // 1. Publish message to the queue *******************************************
  const testMessage = MessageFactoryHelper.getRandomMessage(true);
  retryTestQ.publish(testMessage);

  // ***************************************************************************
  // 2. Start the worker and send the message for a retry **********************
  // Create a worker app to consume this message from the queue.
  const worker = new RetryTestWorker(blink);
  const consumeStub = sandbox.stub(worker, 'consume');
  // First call should send the message to retries.
  consumeStub.onCall(0).callsFake((incomingMessage) => {
    throw new BlinkRetryError('Testing retries', incomingMessage);
  });

  // Setup worker, including dealing infrastructure.
  worker.setup();
  // Spy on the delay infrastructure API call.
  const delayMessageRetrySpy = sandbox.spy(worker.retryDelayer, 'delayMessageRetry');
  // Start consuming messages from the queue.
  worker.start();

  // ***************************************************************************
  // 3. Ensure message has been sent to redis and removed from the queue *******
  // Wait to ensure it worked.
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Consume callback should have been called.
  consumeStub.should.have.been.calledOnce;
  // Delay message retry should have been called for the test messages.
  delayMessageRetrySpy.should.have.been.calledOnce;
  const [delayQArg, delayMessageArg, delayMsArg] = delayMessageRetrySpy.firstCall.args;
  delayQArg.should.equal(retryTestQ);
  delayMessageArg.getData().should.eql(testMessage.getData());
  delayMsArg.should.be.above(0);

  // Messages should have been remvoed from the original queue.
  ackSpy.should.have.been.calledOnce;
  const [ackFirstCallMessageArg] = ackSpy.firstCall.args;
  // Ensure it's the same message.
  ackFirstCallMessageArg.getData().should.eql(testMessage.getData());

  // ***************************************************************************
  // 4. Start the timer to get the message back the queue **********************
  const timer = new RedisRetriesRepublishTimerTask(blink);
  timer.setup();
  timer.start();

  // ***************************************************************************
  // 5. Cleanup
  sandbox.restore();
});


// ------- End -----------------------------------------------------------------
