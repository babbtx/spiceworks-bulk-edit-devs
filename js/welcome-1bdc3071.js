this.Welcome=function(){"use strict";function e(e){try{return window.localStorage.getItem(e)}catch(t){return null}}function t(e,t){try{return window.localStorage.setItem(e,t),window.localStorage.getItem(e)}catch(s){return null}}var s=function(){this.dismissed=e("dismissed-welcome"),this.show=function(){if(!this.dismissed){var e=this;$("body").prepend(JST["templates/welcome"]()),$("#welcome-message").on("closed.bs.alert",function(){e.dismissed=!0,t("dismissed-welcome",!0)})}}};return s}();