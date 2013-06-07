app.service('IRCService', function (Network, Channel, Message, LineSocket) {
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
