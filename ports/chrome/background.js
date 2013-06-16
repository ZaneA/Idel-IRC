'use strict';

chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('main.html', {
    id: 'idel',
    bounds: {
      width: 800,
      height: 400
    },
    minWidth: 500,
    minHeight: 200,
    frame: 'none'
  });
});
