'use strict';

// ------- Imports -------------------------------------------------------------

const test = require('ava');
const chai = require('chai');
require('isomorphic-fetch');

const BlinkWorkerApp = require('../../src/app/BlinkWorkerApp');
const MessageFactoryHelper = require('../helpers/MessageFactoryHelper');

// ------- Init ----------------------------------------------------------------

chai.should();

// ------- Tests ---------------------------------------------------------------

test('Gambit should recieve correct retry count if message has been retried', () => {
  const config = require('../../config');
  const gambitWorkerApp = new BlinkWorkerApp(config, 'gambit-chatbot-mdata-proxy');
  const gambitWorker = gambitWorkerApp.worker;

  // No retry property:
  gambitWorker.getRequestHeaders(MessageFactoryHelper.getValidMdata())
    .should.not.have.property('x-blink-retry-count');

  // retry = 0
  const retriedZero = MessageFactoryHelper.getValidMdata();
  retriedZero.payload.meta.retry = 0;
  gambitWorker.getRequestHeaders(retriedZero)
    .should.not.have.property('x-blink-retry-count');

  // retry = 1
  const retriedOnce = MessageFactoryHelper.getValidMdata();
  retriedOnce.payload.meta.retry = 1;
  gambitWorker.getRequestHeaders(retriedOnce)
    .should.have.property('x-blink-retry-count').and.equal(1);
});


test('Test Gambit response with x-blink-retry-suppress header', () => {
  const config = require('../../config');
  const gambitWorkerApp = new BlinkWorkerApp(config, 'gambit-chatbot-mdata-proxy');
  const gambitWorker = gambitWorkerApp.worker;

  // Gambit order retry suppression
  const retrySuppressResponse = new Response(
    'Unknown Gambit error',
    {
      status: 422,
      statusText: 'Unknown Gambit error',
      headers: {
        // Also make sure that blink recongnizes non standart header case
        'X-BlInK-RetRY-SuPPRESS': 'TRUE',
      },
    }
  );

  gambitWorker.checkRetrySuppress(retrySuppressResponse).should.be.true;


  // Normal Gambit 422 response
  const normalFailedResponse = new Response(
    'Unknown Gambit error',
    {
      status: 422,
      statusText: 'Unknown Gambit error',
      headers: {
        'x-taco-count': 'infinity',
      },
    }
  );
  gambitWorker.checkRetrySuppress(normalFailedResponse).should.be.false;
});

// ------- End -----------------------------------------------------------------