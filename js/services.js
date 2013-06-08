app.service('IRCService', function (Network, LineSocket) {
  this.networks = [];

  var idel = Network({ name: 'Idel' });
  
  this.networks.push(idel);
  
  this.networkByName = function (name) {
    return _.find(this.networks, { name: name });
  };
  
  this.channelByName = function (network, name) {
    return network ? _.find(network.channels, { name: name }) : null;
  };
  
  this.currentNetwork = function () {
    return this.networkByName(this.current.network);
  };
  
  this.getChannel = function (network, channel) {
    return this.channelByName(this.networkByName(network), channel);
  };

  this.currentChannel = function () {
    return this.getChannel(this.current.network, this.current.channel);
  };
  
  this.setCurrentChannel = function (network, channel) {
    this.current.network = network;
    this.current.channel = channel;
    
    var current = this.currentChannel();
    
    current.activity = false;
    
    return current;
  };
  
  this.current = {
    network: 'Idel',
    channel: 'Status'
  };
});

app.service('NickColor', function () {
  this.colors = 6;
  this.current = 0;

  this.get = _.memoize(function (nick) {
    var colorIndex = this.current;

    this.current++;
    if (this.current == this.colors)
      this.current = 0;
    
    return colorIndex;
  });
});

// User settings
app.service('SettingsService', function () {
  this.layout = 'layouts/horizontal.html';
  this.theme = 'themes/dark.json';

  // Use configured networks
  this.networks = [
    {
      name: 'Demonastery',
      servers: ['irc.demonastery.org:6667'],
      nick: 'zanea'
    }
  ];
});

app.service('WindowService', function () {
  this.minimize = function () {
    chrome.app.window.current().minimize();
  };
  
  this.close = function () {
    window.close();
  };
});

app.service('InputService', function ($rootScope, IRCService, SettingsService, Network, Message) {
  this._handlers = [];

  this.register = function (regex, handler, desc) {
    this._handlers.push({ regex: regex, handler: handler, desc: desc });
  };

  this.parse = function (line) {
    var bindObject = {
      network: IRCService.currentNetwork(),
      channel: IRCService.currentChannel(),
      statusChannel: IRCService.getChannel('Idel', 'Status')
    };
    
    for (var i = 0; i < this._handlers.length; i++) {
      var match = line.match(this._handlers[i].regex);
      if (match) {
        match.shift();
        this._handlers[i].handler.apply(bindObject, match);
        return;
      }
    }

    bindObject.network.writeLine('PRIVMSG ' + bindObject.channel.name + ' :' + line);
    $rootScope.$broadcast('irc::message', Message(moment().unix(), bindObject.network.nick, line));
  };
  
  // COMMANDS GO HERE

  var self = this; // HACK Would rather get rid of this

  this.register(/^\/help/, function () {
    for (var i = 0; i < self._handlers.length; i++) {
      this.statusChannel.addLine({ name: 'status', mode: '' }, self._handlers[i].regex.toString() + ':');
      this.statusChannel.addLine({ name: 'status', mode: '' }, ' - ' + self._handlers[i].desc);
    }
  }, 'Display a list of commands.');

  this.register(/^\/connect (.*) (.*) (.*)/, function (name, server, nick) {
    var network = Network({
      name: name,
      servers: [server],
      nick: { name: nick, mode: '' },
      joinChannels: []
    });

    IRCService.networks.push(network);

    network.connect();
  }, 'Connect to a server.');
  
  this.register(/^\/disconnect/, function () {
    this.network.disconnect();
  }, 'Disconnect from the current server.');

  this.register(/^\/join (.*)/, function (channel) {
    this.network.writeLine('JOIN ' + channel);
  }, 'Join a channel.');

  this.register(/^\/part/, function () {
    this.network.writeLine('PART ' + this.channel.name + ' :');
  }, 'Part the current channel.');

  this.register(/^\/quote (.*)/, function (line) {
    this.network.writeLine(line);
  }, 'Send a raw string to the server.');

  this.register(/^\/layout (.*)/, function (layout) {
    SettingsService.layout = 'layouts/' + layout + '.html';
  }, 'Change the current layout.');

  this.register(/^\/theme (.*)/, function (theme) {
    SettingsService.theme = 'themes/' + theme + '.json';
  }, 'Change the current theme.');
});
