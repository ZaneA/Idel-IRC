'use strict';

app.service('PortService', function () {
  this.canMinimize = true;
  this.minimizeWindow = function () {
    chrome.app.window.current().minimize();
  };
  
  this.canClose = true;
  this.closeWindow = function () {
    window.close();
  };
  
  this.saveSettings = function (obj, callback) {
    chrome.storage.sync.set(obj, callback || function () {});
  };
  
  this.loadSettings = function (key, def, callback) {
    chrome.storage.sync.get(key, function (items) {
      callback(_.assign(items, def));
    });
  };
  
  this.clearSettings = function (key, callback) {
    var cb = callback || function () {};

    if (key == null) {
      chrome.storage.sync.clear(cb);
    } else {
      chrome.storage.sync.remove(key, cb);
    }
  };
  
  this._notifyId = 0;
  
  this.notify = function (title, body) {
    var icon = chrome.runtime.getURL('assets/icon-64.png');
    var options = {
      iconUrl: icon,
      priority: 0,
      type: 'simple',
      title: title,
      message: body
    };
    chrome.notifications.create('id' + this._notifyId++, options, function () {});
  };
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

    chrome.socket.create('tcp', {}, function (createInfo) {
      self._socket = createInfo.socketId;
      
      chrome.socket.connect(self._socket, host, parseInt(port), function (result) {
        self._onConnect();
        self.readLoop();
      });
    });
  };
  
  lineSocket.prototype.disconnect = function () {
    chrome.socket.disconnect(this._socket);
    chrome.socket.destroy(this._socket);
    this._onDisconnect();
  };
  
  lineSocket.prototype.readLoop = function () {
    var self = this;

    chrome.socket.read(this._socket, null, function (result) {
      if (result.resultCode < 0)
        return;

      self._lineBuffer += self.arrayBufferToString(result.data);
      var parts = self._lineBuffer.split('\r\n');

      for (var i = 0; i < parts.length - 1; i++) {
        self._onMessage(parts[i]);
      }
      
      self._lineBuffer = parts[parts.length-1];

      self.readLoop();
    });
  };
  
  lineSocket.prototype.writeLine = function (line) {
    line += '\r\n';
    chrome.socket.write(this._socket, this.stringToArrayBuffer(line), function (result) {});
  };
  
  lineSocket.prototype.arrayBufferToString = function (buffer) {
    return String.fromCharCode.apply(String, new Uint8Array(buffer));
  };

  lineSocket.prototype.stringToArrayBuffer = function (string) {
    var buffer = new ArrayBuffer(string.length);
    var bufferView = new Uint8Array(buffer);
    for (var i = 0; i < string.length; i++) {
      bufferView[i] = string.charCodeAt(i);
    }
    return buffer;
  };

  return function () {
    return new lineSocket();
  };
});
