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
});
