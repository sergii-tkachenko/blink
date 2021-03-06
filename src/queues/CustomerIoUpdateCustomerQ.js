'use strict';

const UserMessage = require('../messages/UserMessage');
const Queue = require('../lib/Queue');

class CustomerIoUpdateCustomerQ extends Queue {
  constructor(...args) {
    super(...args);
    this.messageClass = UserMessage;
    this.routes.push('create.user.event');
  }
}

module.exports = CustomerIoUpdateCustomerQ;
