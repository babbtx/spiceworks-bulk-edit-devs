this.DeviceEditor = (function(){
  'use strict';

  var DeviceEditor = function DeviceEditor() {

    // modified from https://datatables.net/reference/option/dom
    var editorLayout =
      "<'row'<'col-sm-12'fBi>>" +
      "<'row'<'col-sm-12'rt>>" +
      "<'row'<'col-sm-12'p>>" ;

    this.defaultEditorOptions = {idSrc: "id"};
    this.defaultTableOptions = {select: true, dom: editorLayout};

    this.editorOptions = undefined;
    this.editor = undefined;
    this.tableOptions = undefined;

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
      return (new SW.Card()).services("inventory")
        .request("devices")
        .then(function(data){
          that.initialResponse = data;
          that.adminDefinedColumns = data.meta.admin_defined_attrs || [];
        });
    };

    this.editorAjaxAdapter = function(method, url, d, successCallback, errorCallback) {

    };

    this.configureEditor = function(selector, editorOptions) {
      var editorFields = this.standardColumns.concat(this.adminDefinedColumns);
      this.editorOptions = _.extend(this.defaultEditorOptions,
        {table: selector, fields: editorFields},
        editorOptions,
        {ajax: this.editorAjaxAdapter});
      return this.editorOptions;
    };

    this.createEditor = function(editorOptions) {
      this.editor = new $.fn.dataTable.Editor(editorOptions);
    };

    this.standardAttributeRenderer = function(def, data, requestType, row, meta) {
      var value = data[def.name] || "";
      if (def.name === "site") {
        if (data["site"] && data["site"].name) {
          value = data["site"].name;
        }
      }
      else if (def.name === "owner") {
        if (data["owner"] && data["owner"].id) {
          value = data["owner"].first_name + " " + data["owner"].last_name;
        }
      }
      return value;
    };

    this.customAttributeRenderer = function(def, data, requestType, row, meta) {
      return data.admin_defined_attrs[def.name] || "";
    };

    this.configureTable = function(tableOptions) {
      var that = this;
      var columnConfigs = [];
      _.each(this.standardColumns, function(def) {
        columnConfigs.push({data: null, render: that.standardAttributeRenderer.bind(that, def)});
      });
      _.each(this.adminDefinedColumns, function(def) {
        columnConfigs.push({data: null, render: that.customAttributeRenderer.bind(that, def)});
      });
      this.tableOptions = _.extend(this.defaultTableOptions,
        {columns: columnConfigs, data: this.initialResponse.devices, buttons: [{extend: "edit", editor: this.editor}]},
        tableOptions);
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

