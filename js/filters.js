'use strict';

app.filter('escape', function () {
  return function (text) {
    if (!text) return '';
    return decodeURIComponent(escape(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')));
  };
});

app.filter('linkify', function () {
  var domainRegexp = /(https?|ftp):\/\/(.*)/;

  var urlPatternReplacer = function (match, contents, offset, s) {
    return '<a href="' + match + '">' + match.match(domainRegexp)[2] + '</a>';
  };

  return function (text) {
    var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;
    return text.replace(urlPattern, urlPatternReplacer);
  };
});

app.filter('timestamp', function () {
  return function (timestamp) {
    return moment.unix(timestamp).format('h:mma');
  };
});

app.filter('nickify', function () {
  return function (nick) {
    return nick.mode + nick.name;
  };
});

app.filter('irccolorize', function () {
  return function (text) {
    // Match color codes and transform
    var colorRegex = /\003([0-9][0-9])/;
    var resetRegex = /\x0f/;
    var end = [];

    var match = null;

    while ((match = text.match(colorRegex))) {
      text = text.replace(colorRegex, '<span class="irc-color-$1">');
      end.push('</span>');
    }
    
    while ((match = text.match(resetRegex))) {
      text = text.replace(resetRegex, end.pop());
    }
    
    return text + end.join('');
  };
});

app.filter('channelOrder', function () {
  return function (list) {
    return _.sortBy(list, function (channel) {
      return channel.name.toLowerCase();
    });
  };
});
