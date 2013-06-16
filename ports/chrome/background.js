'use strict';

chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('main.html', {
    id: 'idel',
    bounds: {
      width: 840,
      height: 380
    },
    minWidth: 500,
    minHeight: 200
  });
});
