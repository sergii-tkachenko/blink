'use strict';

const Joi = require('joi');

const Message = require('./Message');

// TODO: url whitelist
// TODO: authentication
class FetchMessage extends Message {

  constructor(...args) {
    super(...args);

    // Data validation rules.
    this.schema = Joi.object().keys({
      url: Joi.string().required(),
      options: Joi.object(),
    });
  }

  static fromCtx(ctx) {
    // TODO: save more metadata
    // TODO: metadata parse helper
    const fetchMessage = new FetchMessage({
      data: ctx.request.body,
      meta: {
        request_id: ctx.id,
      },
    });
    return fetchMessage;
  }

  static fromRabbitMessage(rabbitMessage) {
    const payload = this.parseIncomingPayload(rabbitMessage);

    // TODO: save more metadata
    // TODO: metadata parse helper
    const fetchMessage = new FetchMessage({
      data: payload.data,
      meta: payload.meta,
    });
    fetchMessage.fields = rabbitMessage.fields;
    return fetchMessage;
  }

}

module.exports = FetchMessage;
