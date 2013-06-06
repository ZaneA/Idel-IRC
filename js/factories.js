app.factory('Network', function () {
  return function (name, servers, nick) {
    return {
      name: name,
      servers: servers,
      nick: nick,
      channels: [],
      _socket: null
    };
  };
});

app.factory('Channel', function (Message) {
  return function (name) {
    return {
      name: name,
      activity: false,
      topic: null,
      nicks: [],
      buffer: [],
      addLine: function (nick, message, timestamp) {
        this.buffer.push(Message(timestamp || moment().unix(), nick, message));
        this.activity = true;
      }
    };
  };
});

app.factory('Message', function () {
  return function (timestamp, nick, message) {
    return {
      timestamp: timestamp,
      nick: nick,
      message: message
    };
  };
});
