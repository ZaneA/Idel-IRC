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
      addLines: function (nick, messages, timestamp) {
        messages.forEach(function (line) {
          this.addLine(nick, line, timestamp);
        }.bind(this));
      },
      addLine: function (nick, message, timestamp) {
        var lines = message.split("\n");
        lines.forEach(function (line) {
          this.buffer.push(Message(timestamp || moment().unix(), nick, line));
        }.bind(this));
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
