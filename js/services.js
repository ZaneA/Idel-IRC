app.service('IRCService', function (Network, Channel, Message) {
  this.networks = [];

  var idel = Network('Idel', [], 'zanea');
  idel.channels.push(Channel('Status'));
  idel.channels[0].activity = true;
  
  var demonastery = Network('Demonastery', ['irc.demonastery.org:6667'], 'zanea');
  demonastery.channels.push(Channel('#Bottest'));
  demonastery.channels[0].topic = 'Test room for bot building.';
  demonastery.channels[0].nicks = ['@anotherboss', '@zanea', 'user1',
                                   'user2', 'user3', 'user4', 'user5', 'bot'];
  demonastery.channels[0].buffer = [
    Message(moment().unix(), 'bot', 'An example bug link, http://redmine.codeshack.co.nz/projects.')
  ];
  demonastery.channels.push(Channel('#Blood-Lust'));
  demonastery.channels[1].topic = 'Stuff, http://i.imgur.com/udlEKw5.png';
  demonastery.channels[1].nicks = ['@zanea', 'Facii', 'Botzy|Work', 'Jaz0r'];
  demonastery.channels.push(Channel('bot'));
  
  var freenode = Network('Freenode', ['chat.freenode.net:6667'], 'zanea');
  freenode.channels.push(Channel('#angularjs'));
  freenode.channels.push(Channel('#chicken'));
  freenode.channels.push(Channel('#cribznetwork'));
  freenode.channels.push(Channel('#powerstack'));
  freenode.channels.push(Channel('#nodejs'));

  this.networks.push(idel);
  this.networks.push(demonastery);
  this.networks.push(freenode);
  
  this.networkByName = function (name) {
    return _.find(this.networks, { name: name });
  };
  
  this.channelByName = function (network, name) {
    return network ? _.find(network.channels, { name: name }) : null;
  };
  
  this.currentNetwork = function () {
    return this.networkByName(this.current.network);
  };

  this.currentChannel = function () {
    return this.channelByName(this.networkByName(this.current.network), this.current.channel);
  };
  
  this.current = {
    network: 'Demonastery',
    channel: '#Bottest'
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
