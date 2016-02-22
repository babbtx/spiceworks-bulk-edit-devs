this.Welcome = (function() {
  'use strict';

  function getStorageValue(key) {
    try {
      return window.localStorage.getItem(key);
    }
    catch (ignored) {
      return null;
    }
  };

  function setStorageValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return window.localStorage.getItem(key);
    }
    catch (ignored) {
      return null;
    }
  };

  var Welcome = function Welcome() {

    this.dismissed = getStorageValue("dismissed-welcome");

    this.show = function() {
      if (!this.dismissed) {
        var that = this;
        $("body").prepend(JST["templates/welcome"]());
        $("#welcome-message").on("closed.bs.alert", function() {
          that.dismissed = true;
          setStorageValue("dismissed-welcome", true);
        });
      }
    };
  };

  return Welcome;

})();