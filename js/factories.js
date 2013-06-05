app.factory('Network', function () {
  return function (name, servers, nick) {
    return {
      name: name,
      servers: servers,
      nick: nick,
      channels: []
    };
  };
});

app.factory('Channel', function () {
  return function (name) {
    return {
      name: name,
      activity: false,
      topic: null,
      nicks: [],
      buffer: []
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
