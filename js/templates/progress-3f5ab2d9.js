(function(){this.JST||(this.JST={}),this.JST["templates/progress"]=function(obj){var __p=[];with(obj||{})__p.push('<div class="modal" id="progress-modal" tabindex="-1" role="dialog">\n  <div class="modal-dialog modal-sm" role="document">\n    <div class="modal-content">\n      <div class="modal-body">\n        '),message&&__p.push('\n          <div class="progress-message h4">',(""+message).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;"),"</div>\n        "),__p.push('\n        <div class="progress">\n          <div class="progress-bar progress-bar-striped active" role="progressbar"\n               aria-valuemin="0" aria-valuemax="100"\n               aria-valuenow="',(""+percentage).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;"),'" style="width: ',(""+percentage).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;"),'%">\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n</div>\n');return __p.join("")}}).call(this);