this.DeviceEditor = (function(){
  'use strict';

  var DeviceEditor = function DeviceEditor() {

    this.service = (new SW.Card()).services("inventory");

    // modified from https://datatables.net/reference/option/dom
    var editorLayout =
      "<'row'<'col-sm-12'fBi>>" +
      "<'row'<'col-sm-12'rt>>" +
      "<'row'<'col-sm-12'p>>" ;

    this.defaultEditorOptions = {idSrc: "id"};
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
      {name: "site", label: "Site Name", type: "text"},
      {name: "primary_owner_name", label: "Owner Name", type: "text"},
      {name: "owner", label: "Owner User Id", type: "text"},
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

    this.editorAjaxAdapter = function(method, url, data, successCallback, errorCallback) {
      debugger;
    };

    this.configureEditor = function(selector, editorOptions) {
      var adminFields = _.collect(this.adminDefinedColumns, function(def){
        var type;
        switch(def.type) {
          case "enum":
            type = "select";
            break;
          case "date":
            type = "date";
            break;
          default:
            type = "text";
        }
        return _.extend(_.pick(def, "name", "label"), {type: type});
      }) ;
      var editorFields = this.standardColumns.concat(adminFields);
      this.editorOptions = _.extend(this.defaultEditorOptions,
        {table: selector, fields: editorFields},
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
            var error = _.isArray(response.errors) ? response.errors[0] : response;
            callback({draw: data.draw,
              error: error.title || error.details || error.message || JSON.stringify(error)
            });
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

