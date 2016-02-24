## Welcome

This is a fully-functional sample application written for app developers learning the 
[Spiceworks Cloud App API](http://developers.spiceworks.com/documentation/cloud-apps).
Spiceworks Cloud Apps are hosted web applications that can be embedded within any installation
of Spiceworks, interacting with the data managed by Spiceworks, and adding value to the
day-to-day of the millions of IT Pros who use [Spiceworks](http://www.spiceworks.com).
 
## About

Spiceworks Bulk Edit is an app for Spiceworks admins to make it easier
to update assets in their device inventory, especially for "bulk updates"
like assigning the same location to multiple assets at once. It is available
in the [Spiceworks App Center](http://appcenter.spiceworks.com/) under the name 
[Easy Asset Editor](https://community.spiceworks.com/appcenter/app/extension_63).

You are welcome to fork and modify this app as you please.

## Tech

This is extremely simple single-page web application using not much 
more than jQuery and Bootstrap. The site is generated using Middleman
and published on Github Pages.

A component called [DataTables](https://datatables.net/) provides the 
sortable, searchable grid and multi-row updating capabilities.

## Setup

#### 1. Install dependencies

You need a working Ruby environment with Bundler, and Bower installed globally. Then:
 
```bash
$ bundle install
$ bower install 
```

Additionally, you will need a copy of [DataTables Editor](https://editor.datatables.net/),
which is a paid component. Copy DataTables Editor and its Bootstrap-styling plugin to the
source directory.

```bash
$ cp dataTables.editor.js source/js/vendor/_dataTables.editor.js
$ cp editor.bootstrap.js source/js/vendor/_editor.bootstrap.js
```

#### 2. Configure

Install the [Spiceworks Developer Edition](http://developers.spiceworks.com/downloads/)
and create a new app. The name and namespace are of your choosing and doesn't necessarily need to
match the hosting URL or domain you will use eventually. For the other fields, use these
values for now:

|Field|Value|
|---|---|
|Full Page URL|`http://localhost:4567/app.html`|
|Environment|Read|
|Inventory|Write|
|Help Desk|None|
|People|Read|
|Reporting|None|
|Extended Data Access|Inventory|
|Extended Data Access|People|

#### 3. Run your app in development mode
 
Middleman runs your single-page web application, watches the filesystem for changes, and reloads
your browser tab when anything changes.
  
```
$ middleman
== The Middleman is loading
== View your site at "http://localhost:4567"
```

#### 4. Develop, modify, play

In your Spiceworks Developer Edition, navigate to your app in the App nav menu.

#### 5. Push to production

Build the static site.

```bash
$ middleman build
```

Push your static site to Github Pages.

```bash
$ middleman deploy
```

## Reference

* [Bower](http://bower.io/)
* [Bootstrap](http://getbootstrap.com/)
* [Middleman](https://middlemanapp.com/)
* [DataTables](https://datatables.net/)
