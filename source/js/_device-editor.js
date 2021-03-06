this.DeviceEditor = (function(){
  'use strict';

  var DeviceEditor = function DeviceEditor(selector, editorOptions, tableOptions) {

    this.service = (new SW.Card()).services("inventory");

    // modified from https://datatables.net/reference/option/dom
    var editorLayout =
      "<'row'<'table-info-left col-sm-6'fi><'table-info-right col-sm-6'B>>" +
      "<'row'<'table-container col-sm-12't>>" +
      "<'row'<'table-paging col-sm-12'p>>" ;

    this.defaultEditorOptions = {table: selector, idSrc: "id", formOptions: {main: {submit: "changed", drawType: "full-hold"}}, i18n: {edit: {title: "<h4>Edit Device(s)</h4>"}, multi: {title: "<strong>Multiple values</strong>", info: '"Multiple values" is shown when the devices do not share a common value for the attribute. Click to change all devices at once.'}}};
    this.defaultTableOptions = {pageLength: 15, search: {caseInsensitive: true, regex: false}, searchDelay: 500, select: true, dom: editorLayout, language: {search: "Search Devices"}};
    this.editorOptions = undefined;
    this.editor = undefined;
    this.tableOptions = undefined;
    this.tableColumns = undefined;
    this.table = undefined;
    this.progress = undefined;

    this.adminDefinedColumns = undefined;
    this.standardColumns = [
      {name: "name", label: "Name", type: "text", orderable: true, searchable: true, visible: true},
      {name: "ip_address", label: "IP Address", type: "text", orderable: true, searchable: false, visible: true},
      {name: "serial_number", label: "Serial Number", type: "text", orderable: false, searchable: false, visible: false},
      {name: "mac_address", label: "MAC Address", type: "text", orderable: false, searchable: false, visible: false},
      {name: "asset_tag", label: "Asset Tag", type: "text", orderable: false, searchable: false, visible: false},
      {name: "device_type", label: "Device Type", type: "text", orderable: true, searchable: false, visible: false},
      {name: "description", label: "Description", type: "text", orderable: false, searchable: false, visible: false},
      {name: "manufacturer", label: "Manufacturer", type: "text", orderable: true, searchable: true, visible: true},
      {name: "model", label: "Model", type: "text", orderable: true, searchable: true, visible: true},
      {name: "location", label: "Location", type: "text", orderable: false, searchable: false, visible: false},
      {name: "site", label: "Site", type: "text", orderable: false, searchable: false, visible: false}, // must be translated to/from site.name
      {name: "owner", label: "Owner", type: "enum", orderable: false, searchable: false, visible: true}, // must be translated to/from user objects
      {name: "purchase_date", label: "Purchase Date", type: "date", orderable: false, searchable: false, visible: false},
      {name: "purchase_price", label: "Purchase Price", type: "text", orderable: false, searchable: false, visible: false},
    ];

    this.users = undefined;
    this.loadAllUsers = function(prevMeta) {
      var that = this;
      // prevMeta is undefined on the first call
      prevMeta = _.extend({current_page: 0, page_count: 1}, prevMeta);
      var page = prevMeta.current_page + 1;
      if (page > prevMeta.page_count) {
        this.users = _.reject(this.users, function(elt){ return elt.label === "System Admin"});
        this.users = _.sortBy(this.users, "label");
        return;
      }
      this.progress.advance(page);
      console.log("API load users page=" + page);
      return (new SW.Card()).services("people")
        .request("people", {page: page, per_page: 10})
        .then(function(response){
          // create array of {label: "first last", value: id}
          var users = _.collect(response.people, function(person) {
            var first = person.first_name || "";
            var last = person.last_name || "";
            var fullName = (first && last) ? first.concat(" ", last) : "(user #".concat(person.id, " no name)");
            return {label: fullName, value: person.id};
          });
          if (that.users) {
            // merge with existing
            that.users = that.users.concat(users);
          }
          else {
            that.users = users;
            that.progress.reset({max: response.meta.page_count + 2, message: "Loading users"});
          }
          return response.meta;
        })
        .then(this.loadAllUsers.bind(this));
    };

    this.initialResponse = undefined;
    this.loadDeviceMeta = function() {
      var that = this;
      // progress bar already exists because of user load
      this.progress.say("Loading devices");
      this.progress.advance(); 
      return this.service
        .request("devices", {sort: [{name: "asc"}], per_page: this.defaultTableOptions.pageLength})
        .then(function(response){
          that.initialResponse = response;
          that.adminDefinedColumns = response.meta.admin_defined_attrs || [];
        })
    };

    this.version = undefined;
    this.sorting = true;
    this.customAttrs = true;
    this.purchaseAttrs = true;
    this.loadVersion = function() {
      var that = this;
      // progress bar already exists because of user and initial device load
      this.progress.say("Initializing");
      this.progress.advance();
      return (new SW.Card()).services("environment")
        .request("environment")
        .then(function(response){
          that.version = response.app_host.version;
          that.sorting = that.version >= "7.5.00065";
          that.customAttrs = that.version >= "7.5.00061";
          that.purchaseAttrs = that.version >= "7.5.00061";
        });
    };
    
    this.errorResponseToString = function errorResponseToString(error) {
      if (_.isArray(error)) {
        return _.collect(error, errorResponseToString).join(", ");
      }
      if (_.isObject(error) && error.errors) {
        return errorResponseToString(error.errors);
      }
      var result = "";
      if (error.title) {
        result = result.concat(error.title, ": ");
      }
      if (error.details) {
        result = result.concat(error.details);
      }
      else if (typeof(error) === "string") {
        result = result.concat(error);
      }
      else {
        result = result.concat(JSON.stringify(error));
      }
      return result;
    };

    this.editorAjaxAdapter = function(method, url, data, callback, xhrErrorCallback) {
      if (data.action !== "edit") {
        xhrErrorCallback(null, "error", "invalid");
        return;
      }
      var that = this;
      var count = _.size(data.data);
      var message = (count > 1) ? "Updating devices" : "Updating device";
      this.progress = new Progress({max: count + 1, message: message});
      var requests = _.collect(data.data, function(updates, id) {
        var d = $.Deferred();
        // hack to get around Spiceworks bug where purchase_price and purchase_date are not updated in an obvious way
        if (!_.isUndefined(updates.purchase_price)) { updates.c_purchase_price = updates.purchase_price; }
        if (!_.isUndefined(updates.purchase_date)) { updates.c_purchase_date = updates.purchase_date; }
        updates = _.omit(updates, "purchase_price", "purchase_date");
        // end of hack
        console.log("API updates for device " + id + ": " + JSON.stringify(updates));
        that.service
          .request("device:update", parseInt(id, 10), updates)
          .then(
            function(response){
              that.progress.advance();
              d.resolve(response);
            },
            function(response){
              console.warn("API device " + id + " update error: ", that.errorResponseToString(response));
              d.reject(response);
            }
          );
        return d.promise();
      });
      $.when.apply($, requests).then(
        function(args) {
          // that.progress.complete() is handled in ajax adapter on table page reload
          var devices = _.toArray(arguments);
          callback({data: devices});
        },
        function(args) {
          that.progress.complete(); // error display handled by editor component
          var errors = _.collect(_.toArray(arguments), that.errorResponseToString).join(", ");
          callback({error: errors});
        }
      );
    };

    this.getEditorField = function(columnConfig, accessor) {
      var type;
      switch(columnConfig.type) {
        case "enum":
          type = "select";
          break;
        case "date":
          type = "date";
          break;
        default:
          type = "text";
      }
      var options = null;
      if (columnConfig.name === "owner") {
        options = this.users;
      }
      else if (type === "select") {
        options = columnConfig.options;
      }
      var field = _.pick(columnConfig, "name", "label");
      _.extend(field, {type: type, data: accessor, options: options});
      // purchase price and date not added until 7.5 patch Feb
      if (!this.purchaseAttrs && (field.name === "purchase_price" || field.name === "purchase_date")) {
        return null;
      }
      return field;
    };

    this.standardAttributeEditorAccessor = function(columnConfig, data, type, value) {
      if (type !== "set") {
        return this.standardAttributeTableRenderer(columnConfig, data);
      }
    };

    this.customAttributeEditorAccessor = function(columnConfig, data, type, value) {
      if (type !== "set") {
        return this.customAttributeTableRenderer(columnConfig, data);
      }
    };

    this.getEditorFields = function() {
      var that = this;
      var fields = [];
      _.each(this.standardColumns, function(columnConfig) {
        fields.push(that.getEditorField(columnConfig, that.standardAttributeEditorAccessor.bind(that, columnConfig)));
      });
      _.each(this.adminDefinedColumns, function(columnConfig) {
        fields.push(that.getEditorField(columnConfig, that.customAttributeEditorAccessor.bind(that, columnConfig)));
      });
      return _.compact(fields);
    };

    this.configureEditor = function() {
      this.editorOptions = _.extend({},
        this.defaultEditorOptions,
        editorOptions,
        {fields: this.getEditorFields(), ajax: this.editorAjaxAdapter.bind(this)});
      return this.editorOptions;
    };

    this.onInitEditor = function() {
      var that = this;
      var editCount = this.table.rows({selected: true}).count();
      if (editCount > 1) {
        // hide attributes that are unique
        // one should not be able to update these to the same value
        _.each(["name", "ip_address", "mac_address", "serial_number", "asset_tag"], function (attr) {
          that.editor.hide(attr);
        });
      }
      else {
        // show everything
        that.editor.show();
      }
    };

    this.onEditorOpen = function(evt, mode, action) {
      if (action === "edit" || this.table.rows({selected: true}).count() > 1) {
        // find the first field with multiple values that is not hidden
        // and show its "multiple values" help text. we have to do this
        // because we are using the API above to hide unique fields,
        // but this is also hiding what is most likely first "multi" field.
        $(".DTE_Form_Content .DTE_Field:not([style*=none]) .multi-value[style*=block]")
          .first()
          .find("[data-dte-e='multi-info']")
          .css("display", "block");
      }
    };

    this.createEditor = function(combinedEditorOptions) {
      this.editor = new $.fn.dataTable.Editor(combinedEditorOptions);
      this.editor.on("initEdit", this.onInitEditor.bind(this));
      this.editor.on("open", this.onEditorOpen.bind(this));
    };

    this.standardAttributeTableRenderer = function(columnConfig, data, requestType, row, meta) {
      var value = data[columnConfig.name] || "";
      if (columnConfig.name === "site") {
        if (data["site"] && data["site"].name) {
          value = data["site"].name;
        }
      }
      else if (columnConfig.name === "owner") {
        if (data["owner"] && data["owner"].id) {
          var first = data["owner"].first_name || "";
          var last = data["owner"].last_name || "";
          value = (first && last) ? first.concat(" ", last) : "(user #".concat(data["owner"].id, " no name)");
        }
        else if (data["primary_owner_name"]) {
          value = data["primary_owner_name"];
        }
      }
      else if (columnConfig.type === "date" && value.match(/\dT\d/)) {
        try {
          var m = moment(value);
          value = m.format("YYYY-MM-DD");
        }
        catch (ignored) {
          // value stays as-is
        }
      }
      return value;
    };

    this.customAttributeTableRenderer = function(columnConfig, data, requestType, row, meta) {
      return data.admin_defined_attrs[columnConfig.name] || "";
    };

    this.getTableColumn = function(columnConfig, renderer) {
      var type;
      switch(columnConfig.type) {
        case "date":
          type = "date";
          break;
        default:
          type = "string";
      }
      var column = _.pick(columnConfig, "name", "visible", "orderable", "searchable");
      _.extend(column, {title: columnConfig.label, type: type, data: null, render: renderer});
      _.defaults(column, {orderable: false, searchable: false, visible: false});
      // purchase price and date not added until 7.5 patch Feb
      if (!this.purchaseAttrs && (column.name === "purchase_price" || column.name === "purchase_date")) {
        return null;
      }
      // sorting wasn't added until 7.5 patch Feb
      if (!this.sorting) {
        column.orderable = false;
      }
      return column;
    };

    this.getTableColumns = function() {
      var that = this;
      var columns = [];
      _.each(this.standardColumns, function(columnConfig) {
        columns.push(that.getTableColumn(columnConfig, that.standardAttributeTableRenderer.bind(that, columnConfig)));
      });
      _.each(this.adminDefinedColumns, function(columnConfig) {
        columns.push(that.getTableColumn(columnConfig, that.customAttributeTableRenderer.bind(that, columnConfig)));
      });
      this.tableColumns = _.compact(columns);
      return this.tableColumns;
    }

    this.tableAjaxAdapter = function(data, callback, settings) {
      var that = this;
      var page = 1 + data.start / this.tableOptions.pageLength;
      var startProgress = function() {
        if (that.progress && !that.progress.isComplete()) {
          // ajax table page reload after update
          that.progress.say("Loading devices");
          that.progress.advance();
        }
        else {
          $(selector + "_wrapper .maskable").addClass("masked");
        }
      };
      var endProgress = function() {
        if (that.progress && !that.progress.isComplete()) {
          that.progress.complete();
        }
        else {
          $(selector + "_wrapper .maskable").removeClass("masked");
        }
      };
      startProgress();
      var requestOptions = {sort: [{name: "asc"}], page: page, per_page: data.length};
      if (data.order && data.order[0]) {
        var sortName = this.tableOptions.columns[data.order[0].column].name;
        var sortDir = data.order[0].dir;
        var sortSpec = {};
        sortSpec[sortName] = sortDir;
        requestOptions.sort[0] = sortSpec;
      }
      if (data.search && data.search.value) {
        requestOptions.search = {query: {terms: data.search.value}, fields: {names: ["name", "manufacturer", "model"]}};
      }
      console.log("API load devices: " + JSON.stringify(requestOptions));
      this.service
        .request("devices", requestOptions)
        .then(
          function(response){
            callback({draw: data.draw,
              data: response.devices,
              recordsTotal: that.initialResponse.meta.total_entries,
              recordsFiltered: response.meta.total_entries
            });
          },
          function(response){
            var error = that.errorResponseToString(response);
            console.warn("API devices fetch error: ", error);
            callback({draw: data.draw, error: error});
          }
        )
        .then(endProgress, endProgress);
    };

    this.configureTable = function() {
      this.tableOptions = _.extend({},
        this.defaultTableOptions,
        tableOptions,
        { columnDefs: [ { // define first column as select
            targets: 0,
            orderable: false,
            className: 'select-checkbox',
            data: null,
            defaultContent: "",
          } ],
          select: { // multi select via checkboxes toggles class on first column
            style: 'multi',
            selector: 'td:first-child'
          },
          order: this.sorting ? [[ 1, 'asc' ]] : [], // default order is second column now
          columns: [{/* checkbox */}].concat(this.getTableColumns()),
          serverSide: true,
          ajax: this.tableAjaxAdapter.bind(this),
          data: this.initialResponse.devices,
          deferLoading: [this.initialResponse.meta.total_entries, this.initialResponse.meta.total_entries],
          buttons: [{extend: "edit", editor: this.editor}]
        }
      );
      return this.tableOptions;
    };

    this.createTable = function(combinedTableOptions) {
      $(selector).DataTable(combinedTableOptions);
      this.table = $(selector).DataTable();
    };

    this.onColumnChooserChange = function($option, checked) {
      this.table.column($option.attr("name") + ":name").visible(checked);
      this.table.columns.adjust();
    };

    this.addColumnChooser = function() {
      // build up <div><select><option></option></select></div>
      var $html = $('<div id="column-selector"><select multiple="multiple"></select></div>');
      var $selector = $html.find("select");
      _.each(this.tableColumns, function(column){
        var $option = $('<option></option>').attr("name", column.name).text(column.title);
        if (column.visible) {
          $option.attr("selected", "selected");
        }
        $option.appendTo($selector);
      });
      $html.appendTo($(".table-info-right"));
      // convert to bootstrap multiselect
      $("#column-selector select").multiselect({
        templates: {
          button: '<button type="button" class="multiselect dropdown-toggle" data-toggle="dropdown"><span class="glyphicon glyphicon-cog" aria-hidden="true"></span> Columns</button>',
          ul: '<ul class="multiselect-container dropdown-menu dropdown-menu-right"></ul>'
        },
        onChange: this.onColumnChooserChange.bind(this)
      });
    };

    this.addMasks = function() {
      $(".table-info-left .dataTables_info").addClass("maskable");
      $(".table-info-right .btn-group").addClass("maskable");
      $(".table-container").addClass("maskable");
      $(".table-paging .dataTables_paginate").addClass("maskable");
    };

    function getSessionValue(key) {
      try {
        return window.sessionStorage.getItem(key);
      }
      catch (ignored) {
        return null;
      }
    };

    function setSessionValue(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
        return window.sessionStorage.getItem(key);
      }
      catch (ignored) {
        return null;
      }
    };

    this.displayUpgrade = function() {
      var that = this;
      var key = "dismissed-spiceworks-upgrade";
      if (getSessionValue(key)) {
        return;
      }
      var upToDate = true;
      upToDate = upToDate && this.sorting;
      upToDate = upToDate && this.customAttrs;
      upToDate = upToDate && this.purchaseAttrs;
      if (!upToDate) {
        var features = [];
        if (!this.sorting) { features.push("sorting by columns"); }
        if (!this.customAttrs) { features.push("editing of custom attributes"); }
        if (!this.purchaseAttrs) { features.push("editing purchase price and date"); }
        features = features.join(", ").replace(/,\s([^,]+)$/, ' and $1'); // to_sentence
        $(selector + "_wrapper").prepend(JST["templates/upgrade"]({features: features}));
        $("#upgrade-spiceworks-message").on("closed.bs.alert", function() {
          // save the version so we can eventually do smarter things
          // if more features are added to spiceworks and this app
          setSessionValue(key, that.version);
        });
      }
    };

    this.load = function() {
      this.progress = new Progress({message: "Loading users"});
      return this.loadAllUsers.call(this)
        .then(this.loadDeviceMeta.bind(this))
        .then(this.loadVersion.bind(this))
        .then(this.configureEditor.bind(this))
        .then(this.createEditor.bind(this))
        .then(this.configureTable.bind(this))
        .then(this.createTable.bind(this))
        .then(this.addColumnChooser.bind(this))
        .then(this.addMasks.bind(this))
        .then(this.displayUpgrade.bind(this))
        .then(null, Rollbar.error.bind(Rollbar))
        .then(this.progress.complete.bind(this.progress),this.progress.complete.bind(this.progress));
    }
  };

  return DeviceEditor;
  
})();

