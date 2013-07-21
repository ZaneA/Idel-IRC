'use strict';

app.service('PortService', function () {
  this.canMinimize = false;
  this.minimizeWindow = function () {};
  
  this.canClose = true;
  this.closeWindow = function () {
    window.close();
  };
  
  this.saveSettings = function (obj, callback) {
    for (var k in obj) {
      window.localStorage.setItem(k, JSON.stringify(obj[k]));
      callback();
    }
  };
  
  // Broken
  this.loadSettings = function (key, def, callback) {
    var obj = JSON.parse(window.localStorage.getItem(key));
    callback(_.assign(obj, def));
  };
  
  this.clearSettings = function (key, callback) {
    if (key == null) {
      window.localStorage.clear();
    } else {
      window.localStorage.removeItem(key);
    }
    
    callback();
  };

  this.notify = function (title, body) {
    humane.timeout = 2500;
    humane.timeoutAfterMove = 2500;
    humane.waitForMove = true;
    humane.log('<strong>%s:</strong> %s'.format(title, body));
  };
  
  // Load Notifications
  var notifyCss = document.createElement('link');
  notifyCss.rel = 'stylesheet';
  notifyCss.href = 'components/humane-js/themes/libnotify.css';
  document.head.appendChild(notifyCss);

  var notifyScript = document.createElement('script');
  notifyScript.src = 'components/humane-js/humane.min.js';
  document.body.appendChild(notifyScript);
});

app.factory('LineSocket', function () {
  function lineSocket () {
    this._lineBuffer = '';
  };

  lineSocket.prototype.connect = function (host, port, onConnect, onMessage, onDisconnect) {
    var self = this;
    
    this._onConnect = onConnect;
    this._onMessage = onMessage;
    this._onDisconnect = onDisconnect;

    this._socket = new WebSocket('ws://127.0.0.1:8080');

    this._socket.onopen = function () {
      self._onConnect();
      self.readLoop();
    };
  };
  
  lineSocket.prototype.disconnect = function () {
    this._socket.close();
    this._onDisconnect();
  };
  
  lineSocket.prototype.readLoop = function () {
    var self = this;
    
    this._socket.onmessage = function (ev) {
      self._lineBuffer += ev.data;
      var parts = self._lineBuffer.split('\r\n');

      for (var i = 0; i < parts.length - 1; i++) {
        self._onMessage(parts[i]);
      }
      
      self._lineBuffer = parts[parts.length-1];
    };
  };
  
  lineSocket.prototype.writeLine = function (line) {
    line += '\r\n';
    this._socket.send(line);
  };

  return function () {
    return new lineSocket();
  };
});
