this.Progress = (function() {
  'use strict';

  var selector = "#progress-modal";

  var singleton;

  var defaults = {
    message: "",
    indeterminate: true,
    max: 100,
  };

  var Progress = function Progress(options) {

    this.options = _.extend({}, defaults, options);
    this.options.value = 0;
    this.options.percentage = this.options.indeterminate ? 100 : 0;

    function init() {
      $("body").append(JST["templates/progress"](this.options));
      this.$el = $(selector);
      this.$el.modal({backdrop: "static", keyboard: false});
    };

    function remove() {
      this.$el.modal("hide");
      this.$el.remove();
    };

    if (singleton) {
      remove.call(singleton);
      singleton = this;
    }
    else {
      init.call(this);
      singleton = this;
    }

    this.$el.modal("show");

    function updateMessage() {
      var $message = this.$el.find(".progress-message");
      $message.text(this.options.message);
    }

    function updateBar() {
      var $bar = this.$el.find(".progress-bar");
      $bar.attr("aria-valuenow", this.options.percentage);
      $bar.css("width", this.options.percentage + "%");
    }

    this.reset = function(options) {
      this.options = _.extend({}, defaults, options);
      // TODO if was not and becomes indeterminate then we shouldn't bump to 100
      this.options.value = 0;
      this.options.percentage = this.options.indeterminate ? 100 : 0;
      updateBar.call(this);
      updateMessage.call(this);
    };

    this.say = function(message) {
      this.options.message = message;
      updateMessage.call(this);
    };

    this.advance = function(value) {
      this.options.value = value || (this.options.value || 0) + 1;
      this.options.percentage = this.options.value * 100 / this.options.max;
      updateBar.call(this);
    };

    this.complete = function() {
      this.advance(this.options.max);
      this.$el.modal("hide");
    };
  };

  return Progress;

})();