this.DeviceEditor = (function(){
  'use strict';

  var DeviceEditor = function DeviceEditor(selector, editorOptions, tableOptions) {

    this.service = (new SW.Card()).services("inventory");

    // modified from https://datatables.net/reference/option/dom
    var editorLayout =
      "<'row'<'table-info-left col-sm-6'fi><'table-info-right col-sm-6'B>>" +
      "<'row'<'table-container col-sm-12't>>" +
      "<'row'<'table-paging col-sm-12'p>>" ;

    this.defaultEditorOptions = {table: selector, idSrc: "id", formOptions: {main: {submit: "changed", drawType: "full-hold", title: "Edit Device(s)"}}};
    this.defaultTableOptions = {pageLength: 15, search: {caseInsensitive: true, regex: false}, searchDelay: 500, select: true, dom: editorLayout};
    this.editorOptions = undefined;
    this.tableOptions = undefined;
    this.editor = undefined;
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
            var fullName = person.first_name.concat(" ", person.last_name);
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
      this.progress.advance(); // already exists because of user load
      return this.service
        .request("devices", {sort: [{name: "asc"}], per_page: this.defaultTableOptions.pageLength})
        .then(function(response){
          that.initialResponse = response;
          that.adminDefinedColumns = response.meta.admin_defined_attrs || [];
        })
        .then(that.progress.complete.bind(that.progress),that.progress.complete.bind(that.progress));
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
      var field = _.pick(columnConfig, "name", "label");
      _.extend(field, {type: type, data: accessor, options: options});
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
      return fields;
    };

    this.configureEditor = function() {
      this.editorOptions = _.extend({},
        this.defaultEditorOptions,
        editorOptions,
        {fields: this.getEditorFields(), ajax: this.editorAjaxAdapter.bind(this)});
      return this.editorOptions;
    };

    this.createEditor = function(combinedEditorOptions) {
      this.editor = new $.fn.dataTable.Editor(combinedEditorOptions);
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
          value = data["owner"].first_name + " " + data["owner"].last_name;
        }
        else if (data["primary_owner_name"]) {
          value = data["primary_owner_name"];
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
      return columns;
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
          order: [[ 1, 'asc' ]], // default order is second column now
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
    };

    this.addMasks = function() {
      $(".table-info-left .dataTables_info").addClass("maskable");
      $(".table-info-right .btn-group").addClass("maskable");
      $(".table-container").addClass("maskable");
      $(".table-paging .dataTables_paginate").addClass("maskable");
    };

    this.load = function() {
      this.progress = new Progress({message: "Loading users"});
      return this.loadAllUsers.call(this)
        .then(this.progress.say.bind(this.progress, "Loading devices"))
        .then(this.loadDeviceMeta.bind(this))
        .then(this.configureEditor.bind(this))
        .then(this.createEditor.bind(this))
        .then(this.configureTable.bind(this))
        .then(this.createTable.bind(this))
        .then(this.addMasks.bind(this))
        .then(this.progress.complete.bind(this.progress))
        .then(null, console.error.bind(console));
    }
  };

  return DeviceEditor;
  
})();

