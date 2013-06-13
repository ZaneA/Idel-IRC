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
