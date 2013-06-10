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
});
