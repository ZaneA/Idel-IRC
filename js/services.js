app.service('IRCService', function (Network, Channel, Message) {
  this.networks = [];

  var idel = Network('Idel', [], 'zanea');
  idel.channels.push(Channel('Status'));
  idel.channels.push(Channel('test'));
  idel.channels[0].nicks = ['@zanea', 'bot'];
  
  this.networks.push(idel);
  
  this.connect = function (network) {
    chrome.socket.create('tcp', {}, function (createInfo) {
      network._socket = createInfo.socketId;
      var parts = network.servers[0].split(':');
      chrome.socket.connect(network._socket, parts[0], parseInt(parts[1]), function (result) {
        console.log(result);
        chrome.socket.disconnect(network._socket);
        chrome.socket.destroy(network._socket);
      });
    });
  };
  
  //var demonastery = Network('Demonastery', ['irc.demonastery.org:6667'], 'zanea');
  //demonastery.channels.push(Channel('#Bottest'));
  //demonastery.channels[0].topic = 'Test channel for bot building.';
  //demonastery.channels[0].nicks = ['@zanea', 'bot'];
  //demonastery.channels[0].buffer = [
  //  Message(moment().unix(), 'bot', 'An example URL, http://angularjs.org.')
  //];
  
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
    channel: 'test'
  };
});

app.service('NickColor', function () {
  this.colors = 5;
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
