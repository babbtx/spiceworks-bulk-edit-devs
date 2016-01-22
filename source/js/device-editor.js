this.DeviceEditor = (function(){
  'use strict';

  var DeviceEditor = function DeviceEditor() {

    this.service = (new SW.Card()).services("inventory");

    // modified from https://datatables.net/reference/option/dom
    var editorLayout =
      "<'row'<'col-sm-12'fBi>>" +
      "<'row'<'col-sm-12'rt>>" +
      "<'row'<'col-sm-12'p>>" ;

    this.defaultEditorOptions = {idSrc: "id", formOptions: {main: {submit: "changed", drawType: "full-hold", title: "Edit Device(s)"}}};
    this.defaultTableOptions = {pageLength: 15, select: true, dom: editorLayout};
    this.editorOptions = undefined;
    this.tableOptions = undefined;
    this.editor = undefined;

    this.adminDefinedColumns = undefined;
    this.standardColumns = [
      {name: "name", label: "Name", type: "text"},
      {name: "description", label: "Description", type: "text"},
      {name: "manufacturer", label: "Manufacturer", type: "text"},
      {name: "model", label: "Model", type: "text"},
      {name: "mac_address", label: "MAC Address", type: "text"},
      {name: "ip_address", label: "IP Address", type: "text"},
      {name: "serial_number", label: "Serial Number", type: "text"},
      {name: "asset_tag", label: "Asset Tag", type: "text"},
      {name: "device_type", label: "Device Type", type: "text"},
      {name: "site", label: "Site Name", type: "text"}, // must be translated to/from site.name
      {name: "owner", label: "Owner", type: "text"}, // must be translated to/from user objects
      {name: "purchase_date", label: "Purchase Date", type: "date"},
      {name: "purchase_price", label: "Purchase Price", type: "text"},
    ];

    this.loadDeviceMeta = function() {
      var that = this;
      return this.service
        .request("devices")
        .then(function(response){
          that.initialResponse = response;
          that.adminDefinedColumns = response.meta.admin_defined_attrs || [];
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
      var requests = _.collect(data.data, function(updates, id) {
        var d = $.Deferred();
        console.log("API updates for device " + id + ": " + JSON.stringify(updates));
        that.service
          .request("device:update", parseInt(id, 10), updates)
          .then(
            function(response){
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
          var devices = _.toArray(arguments);
          callback({data: devices});
        },
        function(args) {
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
      return {name: columnConfig.name, label: columnConfig.label, type: type, data: accessor};
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

    this.configureEditor = function(selector, editorOptions) {
      this.editorOptions = _.extend(this.defaultEditorOptions,
        {table: selector, fields: this.getEditorFields()},
        editorOptions,
        {ajax: this.editorAjaxAdapter.bind(this)});
      return this.editorOptions;
    };

    this.createEditor = function(editorOptions) {
      this.editor = new $.fn.dataTable.Editor(editorOptions);
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
      }
      return value;
    };

    this.customAttributeTableRenderer = function(columnConfig, data, requestType, row, meta) {
      return data.admin_defined_attrs[columnConfig.name] || "";
    };

    this.getTableColumns = function() {
      var that = this;
      var columns = [];
      _.each(this.standardColumns, function(columnConfig) {
        columns.push({data: null, render: that.standardAttributeTableRenderer.bind(that, columnConfig)});
      });
      _.each(this.adminDefinedColumns, function(columnConfig) {
        columns.push({data: null, render: that.customAttributeTableRenderer.bind(that, columnConfig)});
      });
      return columns;
    }

    this.tableAjaxAdapter = function(data, callback, settings) {
      var that = this;
      var page = 1 + data.start / this.tableOptions.pageLength;
      this.service
        .request("devices", {page: page, per_page: data.length})
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
        );
    };

    this.configureTable = function(tableOptions) {
      this.tableOptions = _.extend(this.defaultTableOptions,
        tableOptions,
        { columns: this.getTableColumns(),
          serverSide: true, ajax: this.tableAjaxAdapter.bind(this),
          data: this.initialResponse.devices,
          buttons: [{extend: "edit", editor: this.editor}]
        }
      );
      return this.tableOptions;
    };

    this.createTable = function(selector, tableOptions) {
      var $table = $(selector);
      var headings = _.inject(_.pluck(this.editorOptions.fields, "label"), function(retval, label){
        retval = retval || [];
        retval.push("<td>" + label + "</td>");
        return retval;
      }, []);
      $table.find("thead").empty().html("<tr>" + headings + "</tr>");
      $(selector).DataTable(tableOptions);
    };

    this.load = function(selector, editorOptions, tableOptions) {
      var that = this;
      return this.loadDeviceMeta.call(this)
        .then(this.configureEditor.bind(this, selector, editorOptions))
        .then(this.createEditor.bind(this))
        .then(this.configureTable.bind(this, tableOptions))
        .then(this.createTable.bind(this, selector));
    }
  };

  return DeviceEditor;
  
})();

