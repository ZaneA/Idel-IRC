'use strict';

// TLS support using https://github.com/digitalbazaar/forge
// Currently errors out with "Incompatible TLS Version"
app.factory('TLSLineSocket', function (LineSocket) {
  function tlsLineSocket () {
    var self = this;
    this._socket = null;
    this._lineBuffer = '';
    this._tlsConnection = window.forge.tls.createConnection({
      server: false,
      caStore: [],
      sessionCache: {},
      cipherSuites: [
        window.forge.tls.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA,
        window.forge.tls.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA
      ],
      virtualHost: 'server',
      verify: function (c, verified, depth, certs) { return true; },
      connected: function (c) {
        console.log('connected');
      },
      tlsDataReady: function (c) {
        console.log('data ready to be sent');
        chrome.socket.write(self._socket, self.stringToArrayBuffer(c.tlsData.getBytes()), function (result) {});
      },
      dataReady: function (c) {
        console.log('data incoming');

        self._lineBuffer += self.arrayBufferToString(c.data.getBytes());
        var parts = self._lineBuffer.split("\r\n");

        for (var i = 0; i < parts.length - 1; i++) {
          self._onMessage(parts[i]);
        }
        
        self._lineBuffer = parts[parts.length-1];
      },
      closed: function (c) {
        console.log('disconnected');
        self.disconnect();
      },
      error: function (c, err) {
        console.error('uh oh', err);
      }
    });
  };

  tlsLineSocket.prototype.connect = function (host, port, onConnect, onMessage, onDisconnect) {
    var self = this;
    
    this._onConnect = onConnect;
    this._onMessage = onMessage;
    this._onDisconnect = onDisconnect;

    chrome.socket.create('tcp', {}, function (createInfo) {
      self._socket = createInfo.socketId;
      
      chrome.socket.connect(self._socket, host, parseInt(port), function (result) {
        self._tlsConnection.handshake();
        self._onConnect();
        self.readLoop();
      });
    });
  };
  
  tlsLineSocket.prototype.disconnect = function () {
    chrome.socket.disconnect(this._socket);
    chrome.socket.destroy(this._socket);
    this._onDisconnect();
  };
  
  tlsLineSocket.prototype.readLoop = function () {
    var self = this;

    chrome.socket.read(this._socket, null, function (result) {
      if (result.resultCode < 0)
        return;
      
      self._tlsConnection.process(result.data);

      self.readLoop();
    });
  };
  
  tlsLineSocket.prototype.writeLine = function (line) {
    line += "\r\n";
    this._tlsConnection.prepare(this.stringToArrayBuffer(line));
  };

  tlsLineSocket.prototype.arrayBufferToString = function (buffer) {
    return String.fromCharCode.apply(String, new Uint8Array(buffer));
  };

  tlsLineSocket.prototype.stringToArrayBuffer = function (string) {
    var buffer = new ArrayBuffer(string.length);
    var bufferView = new Uint8Array(buffer);
    for (var i = 0; i < string.length; i++) {
      bufferView[i] = string.charCodeAt(i);
    }
    return buffer;
  };

  return function () {
    return new tlsLineSocket();
  };
});
