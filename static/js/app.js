var editor;
var connected = false;
var bookmarks = {};
var default_rows_limit = 100;

var filterOptions = {
  "equal":      "= 'DATA'",
  "not_equal":  "!= 'DATA'",
  "greater":    "> 'DATA'" ,
  "greater_eq": ">= 'DATA'",
  "less":       "< 'DATA'",
  "less_eq":    "<= 'DATA'",
  "like":       "LIKE 'DATA'",
  "ilike":      "ILIKE 'DATA'",
  "null":       "IS NULL",
  "not_null":   "IS NOT NULL"
};

function setRowsLimit(num) {
  localStorage.setItem("rows_limit", num);
}

function getRowsLimit() {
  return parseInt(localStorage.getItem("rows_limit") || default_rows_limit);
}

function getPaginationOffset() {
  var page  = $(".current-page").data("page");
  var limit = getRowsLimit();
  return (page - 1) * limit;
}

function getPagesCount(rowsCount) {
  var limit = getRowsLimit();
  var num = parseInt(rowsCount / limit);

  if ((num * limit) < rowsCount) {
    num++;
  }

  return num;
}

function apiCall(method, path, params, cb) {
  $.ajax({
    url: "/api" + path,
    method: method,
    cache: false,
    data: params,
    success: function(data) {
      cb(data);
    },
    error: function(xhr, status, data) {
      cb(jQuery.parseJSON(xhr.responseText));
    }
  });
}

function getTables(cb)                  { apiCall("get", "/tables", {}, cb); }
function getTableRows(table, opts, cb)  { apiCall("get", "/tables/" + table + "/rows", opts, cb); }
function getTableStructure(table, cb)   { apiCall("get", "/tables/" + table, {}, cb); }
function getTableIndexes(table, cb)     { apiCall("get", "/tables/" + table + "/indexes", {}, cb); }
function getTableConstraints(table, cb) { apiCall("get", "/tables/" + table + "/constraints", {}, cb); }
function getHistory(cb)                 { apiCall("get", "/history", {}, cb); }
function getBookmarks(cb)               { apiCall("get", "/bookmarks", {}, cb); }
function getSequences(cb)               { apiCall("get", "/sequences", {}, cb); }

function encodeQuery(query) {
  return window.btoa(query);
}

function executeQuery(query, cb) {
  apiCall("post", "/query", { query: query }, cb);
}

function explainQuery(query, cb) {
  apiCall("post", "/explain", { query: query }, cb);
}

function loadTables() {
  $("#tables li").remove();

  getTables(function(data) {
    data.forEach(function(item) {
      $("<li><span><i class='fa fa-table'></i> " + item + " </span></li>").appendTo("#tables");
    });
  });
}

function loadSequences() {
  $("#sequences li").remove();

  getSequences(function(data) {
    data.forEach(function(item) {
      $("<li><span><i class='fa fa-chevron-right'></i> " + item + " </span></li>").appendTo("#sequences");
    });
  });
}

function escapeHtml(str) {
  if (str != null || str != undefined) {
    return jQuery("<div/>").text(str).html();
  }

  return "<span class='null'>null</span>";
}

function unescapeHtml(str){
  var e = document.createElement("div");
  e.innerHTML = str;
  return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

function getCurrentTable() {
  return $("#tables").attr("data-current") || "";
}

function resetTable() {
  $("#results").
    attr("data-mode", "").
    text("").
    removeClass("empty").
    removeClass("no-crop");
}

function performTableAction(table, action, el) {
  if (action == "truncate" || action == "delete") {
    var message = "Are you sure you want to " + action + " table " + table + " ?";
    if (!confirm(message)) return;
  }

  switch(action) {
    case "truncate":
      executeQuery("TRUNCATE TABLE " + table, function(data) {
        if (data.error) alert(data.error);
        resetTable();
      });
      break;
    case "delete":
      executeQuery("DROP TABLE " + table, function(data) {
        if (data.error) alert(data.error);
        loadTables();
        loadSequences();
        resetTable();
      });
      break;
    case "export":
      var format = el.data("format");
      var filename = table + "." + format;
      var query = window.encodeURI("SELECT * FROM " + table);
      var url = "http://" + window.location.host + "/api/query?format=" + format + "&filename=" + filename + "&query=" + query;
      var win  = window.open(url, "_blank");
      win.focus();
      break;
  }
}

function sortArrow(direction) {
  switch (direction) {
    case "ASC":
      return "&#x25B2;";
    case "DESC":
      return "&#x25BC;";
    default:
      return "";
  }
}

function buildTable(results, sortColumn, sortOrder) {
  resetTable();

  if (results.error) {
    $("<tr><td>ERROR: " + results.error + "</tr></tr>").appendTo("#results");
    $("#results").addClass("empty");
    return;
  }

  if (!results.rows) {
    $("<tr><td>No records found</tr></tr>").appendTo("#results");
    $("#results").addClass("empty");
    return;
  }

  var cols = "";
  var rows = "";

  results.columns.forEach(function(col) {
    if (col === sortColumn) {
      cols += "<th class='active' data='" + col + "'" + "data-sort-order=" + sortOrder + ">" + col + "&nbsp;" + sortArrow(sortOrder) + "</th>";
    }
    else {
      cols += "<th data='" + col + "'>" + col + "</th>";
    }
  });

  results.rows.forEach(function(row) {
    var r = "";
    for (i in row) { r += "<td><div>" + escapeHtml(row[i]) + "</div></td>"; }
    rows += "<tr>" + r + "</tr>";
  });

  $("<thead>" + cols + "</thead><tbody>" + rows + "</tobdy>").appendTo("#results");
}

function setCurrentTab(id) {
  $("#nav ul li.selected").removeClass("selected");
  $("#" + id).addClass("selected");
}

function showQueryHistory() {
  getHistory(function(data) {
    var rows = [];

    for(i in data) {
      rows.unshift([parseInt(i) + 1, data[i].query, data[i].timestamp]);
    }

    buildTable({ columns: ["id", "query", "timestamp"], rows: rows });

    setCurrentTab("table_history");
    $("#input").hide();
    $("#body").prop("class", "full");
    $("#results").addClass("no-crop");
  });
}

function showTableIndexes() {
  var name = getCurrentTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  getTableIndexes(name, function(data) {
    setCurrentTab("table_indexes");
    buildTable(data);

    $("#input").hide();
    $("#body").prop("class", "full");
    $("#results").addClass("no-crop");
  });
}

function showTableConstraints() {
  var name = getCurrentTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  getTableConstraints(name, function(data) {
    setCurrentTab("table_constraints");
    buildTable(data);

    $("#input").hide();
    $("#body").prop("class", "full");
    $("#results").addClass("no-crop");
  });
}

function showTableInfo() {
  var name = getCurrentTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  apiCall("get", "/tables/" + name + "/info", {}, function(data) {
    $(".table-information ul").show();
    $("#table_total_size").text(data.total_size);
    $("#table_data_size").text(data.data_size);
    $("#table_index_size").text(data.index_size);
    $("#table_rows_count").text(data.rows_count);
    $("#table_encoding").text("Unknown");
  });

  buildTableFilters(name);
}

function updatePaginator(pagination) {
  if (!pagination) {
    $(".current-page").data("page", 1).data("pages", 1);
    $("button.page").text("1 of 1");
    $(".prev-page, .next-page").prop("disabled", "disabled");
    return;
  }

  $(".current-page").
    data("page", pagination.page).
    data("pages", pagination.pages_count);

  if (pagination.page > 1) {
    $(".prev-page").prop("disabled", "");
  }
  else {
    $(".prev-page").prop("disabled", "disabled");
  }

  if (pagination.pages_count > 1 && pagination.page < pagination.pages_count) {
    $(".next-page").prop("disabled", "");
  }
  else {
    $(".next-page").prop("disabled", "disabled");
  }

  $("#total_records").text(pagination.rows_count);
  if (pagination.pages_count == 0) pagination.pages_count = 1;
  $("button.page").text(pagination.page + " of " + pagination.pages_count);
}

function showTableContent(sortColumn, sortOrder) {
  var name = getCurrentTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  var opts = {
    limit:       getRowsLimit(),
    offset:      getPaginationOffset(),
    sort_column: sortColumn,
    sort_order:  sortOrder
  };

  var filter = {
    column: $(".filters select.column").val(),
    op:     $(".filters select.filter").val(),
    input:  $(".filters input").val()
  };

  // Apply filtering only if column is selected
  if (filter.column && filter.op) {
    var where = [
      filter.column,
      filterOptions[filter.op].replace("DATA", filter.input)
    ].join(" ");

    opts["where"] = where;
  }

  getTableRows(name, opts, function(data) {
    $("#results").attr("data-mode", "browse");
    $("#input").hide();
    $("#body").prop("class", "with-pagination");

    buildTable(data, sortColumn, sortOrder);
    setCurrentTab("table_content");
    updatePaginator(data.pagination);
  });
}

function showTableStructure() {
  var name = getCurrentTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  setCurrentTab("table_structure");
  
  $("#input").hide();
  $("#body").prop("class", "full");

  getTableStructure(name, function(data) {
    buildTable(data);
    $("#results").addClass("no-crop");
  });
}

function showQueryPanel() {
  setCurrentTab("table_query");
  editor.focus();

  $("#input").show();
  $("#body").prop("class", "")
}

function showConnectionPanel() {
  setCurrentTab("table_connection");

  apiCall("get", "/connection", {}, function(data) {
    var rows = [];

    for(key in data) {
      rows.push([key, data[key]]);
    }

    buildTable({
      columns: ["attribute", "value"],
      rows: rows
    });

    $("#input").hide();
    $("#body").addClass("full");
  });
}

function showActivityPanel() {
  setCurrentTab("table_activity");

  apiCall("get", "/activity", {}, function(data) {
    buildTable(data);
    $("#input").hide();
    $("#body").addClass("full");
  });
}

function runQuery() {
  setCurrentTab("table_query");

  $("#run, #explain, #csv, #json, #xml").prop("disabled", true);
  $("#query_progress").show();

  var query = $.trim(editor.getSelectedText() || editor.getValue());

  if (query.length == 0) {
    $("#run, #explain, #csv, #json, #xml").prop("disabled", false);
    $("#query_progress").hide();
    return;
  }

  executeQuery(query, function(data) {
    buildTable(data);

    $("#run, #explain, #csv, #json, #xml").prop("disabled", false);
    $("#query_progress").hide();
    $("#input").show();
    $("#body").removeClass("full");

    if (query.toLowerCase().indexOf("explain") != -1) {
      $("#results").addClass("no-crop");
    }

    var re = /(create|drop) table/i;

    // Refresh tables list if table was added or removed
    if (query.match(re)) {
      loadTables();
      loadSequences();
    }
  });
}

function runExplain() {
  setCurrentTab("table_query");

  $("#run, #explain, #csv, #json, #xml").prop("disabled", true);
  $("#query_progress").show();

  var query = $.trim(editor.getValue());

  if (query.length == 0) {
    $("#run, #explain, #csv, #json, #xml").prop("disabled", false);
    $("#query_progress").hide();
    return;
  }

  explainQuery(query, function(data) {
    buildTable(data);

    $("#run, #explain, #csv, #json, #xml").prop("disabled", false);
    $("#query_progress").hide();
    $("#input").show();
    $("#body").removeClass("full");
    $("#results").addClass("no-crop");
  });
}

function exportTo(format) {
  var query = $.trim(editor.getValue());

  if (query.length == 0) {
    return;
  }

  var url = "http://" + window.location.host + "/api/query?format=" + format + "&query=" + encodeQuery(query);
  var win = window.open(url, '_blank');

  setCurrentTab("table_query");
  win.focus();
}

function buildTableFilters(name) {
  getTableStructure(name, function(data) {
    if (data.rows.length == 0) {
      $("#pagination .filters").hide();
    }

    $("#pagination select.column").html("<option value='' selected>Select column</option>");

    for (row of data.rows) {
      var el = $("<option/>").attr("value", row[0]).text(row[0]);
      $("#pagination select.column").append(el);
    }
  });
}

function initEditor() {
  var writeQueryTimeout = null;
  editor = ace.edit("custom_query");

  editor.setFontSize(13);
  editor.setTheme("ace/theme/tomorrow");
  editor.setShowPrintMargin(false);
  editor.getSession().setMode("ace/mode/pgsql");
  editor.getSession().setTabSize(2);
  editor.getSession().setUseSoftTabs(true);

  editor.commands.addCommands([{
    name: "run_query",
    bindKey: {
      win: "Ctrl-Enter",
      mac: "Command-Enter"
    },
    exec: function(editor) {
      runQuery();
    }
  }, {
    name: "explain_query",
    bindKey: {
      win: "Ctrl-E",
      mac: "Command-E"
    },
    exec: function(editor) {
      runExplain();
    }
  }]);

  editor.on("change", function() {
    if (writeQueryTimeout) {
      clearTimeout(writeQueryTimeout);
    }

    writeQueryTimeout = setTimeout(function() {
      localStorage.setItem("pgweb_query", editor.getValue());
    }, 1000);
  });

  var query = localStorage.getItem("pgweb_query");
  if (query && query.length > 0) {
    editor.setValue(query);
    editor.clearSelection();
  }
}

function addShortcutTooltips() {
  if (navigator.userAgent.indexOf("OS X") > 0) {
    $("#run").attr("title", "Shortcut: ⌘+Enter");
    $("#explain").attr("title", "Shortcut: ⌘+E");
  }
  else {
    $("#run").attr("title", "Shortcut: Ctrl+Enter");
    $("#explain").attr("title", "Shortcut: Ctrl+E");
  }
}

function showConnectionSettings() {
  getBookmarks(function(data) {
    // Do not add any bookmarks if we've got an error
    if (data.error) {
      return;
    }

    if (Object.keys(data).length > 0) {
      // Set bookmarks in global var
      bookmarks = data;

      // Remove all existing bookmark options
      $("#connection_bookmarks").html("");

      // Add blank option
      $("<option value=''></option>").appendTo("#connection_bookmarks");

      // Add all available bookmarks
      for (key in data) {
        $("<option value='" + key + "''>" + key + "</option>").appendTo("#connection_bookmarks");
      }

      $(".bookmarks").show();
    }
    else {
      $(".bookmarks").hide();
    }
  });

  $("#connection_window").show();
}

function getConnectionString() {
  var url  = $.trim($("#connection_url").val());
  var mode = $(".connection-group-switch button.active").attr("data");
  var ssl  = $("#connection_ssl").val();

  if (mode == "standard") {
    var host = $("#pg_host").val();
    var port = $("#pg_port").val();
    var user = $("#pg_user").val();
    var pass = encodeURIComponent($("#pg_password").val());
    var db   = $("#pg_db").val();

    if (port.length == 0) {
      port = "5432";
    }

    url = "postgres://" + user + ":" + pass + "@" + host + ":" + port + "/" + db + "?sslmode=" + ssl;
  }
  else {
    var local = url.indexOf("localhost") != -1 || url.indexOf("127.0.0.1") != -1;

    if (local && url.indexOf("sslmode") == -1) {
      url += "?sslmode=" + ssl;
    }
  }

  return url;
}

$(document).ready(function() {
  $("#table_content").on("click",     function() { showTableContent();     });
  $("#table_structure").on("click",   function() { showTableStructure();   });
  $("#table_indexes").on("click",     function() { showTableIndexes();     });
  $("#table_constraints").on("click", function() { showTableConstraints(); });
  $("#table_history").on("click",     function() { showQueryHistory();     });
  $("#table_query").on("click",       function() { showQueryPanel();       });
  $("#table_connection").on("click",  function() { showConnectionPanel();  });
  $("#table_activity").on("click",    function() { showActivityPanel();    });

  $("#run").on("click", function() {
    runQuery();
  });

  $("#explain").on("click", function() {
    runExplain();
  });

  $("#csv").on("click", function() {
    exportTo("csv");
  });

  $("#json").on("click", function() {
    exportTo("json");
  });

  $("#xml").on("click", function() {
    exportTo("xml");
  });

  $("#results").on("click", "tr", function() {
    $("#results tr.selected").removeClass();
    $(this).addClass("selected");
  });

  $("#results").on("click", "th", function(e) {
    var sortColumn = this.attributes['data'].value;
    var contentTab = $('#table_content').hasClass('selected');

    if (!contentTab) {
      return;
    }

    if (this.dataset.sortOrder === "ASC") {
      this.dataset.sortOrder = "DESC"
    }
    else {
      this.dataset.sortOrder = "ASC"
    }

    showTableContent(sortColumn, this.dataset.sortOrder);
  });

  $("#results").on("dblclick", "td > div", function() {
    if ($(this).has("textarea").length > 0) {
      return;
    }

    var value = unescapeHtml($(this).html());
    if (!value) { return; }

    var textarea = $("<textarea />").
      text(value).
      addClass("form-control").
      css("width", $(this).css("width"));

    if (value.split("\n").length >= 3) {
      textarea.css("height", "200px");
    }

    $(this).html(textarea).css("max-height", "200px");
  });

  $("#tables").on("click", "li", function() {
    $("#tables li.selected").removeClass("selected");
    $("#sequences li.selected").removeClass("selected");
    $(this).addClass("selected");
    $("#tables").attr("data-current", $.trim($(this).text()));
    $(".current-page").data("page", 1);
    $(".filters select, .filters input").val("");

    showTableContent();
    showTableInfo();
  });

  $("#tables").contextmenu({
    target: "#tables_context_menu",
    scopes: "li",
    onItem: function(context, e) {
      var el      = $(e.target);
      var table   = $.trim($(context[0]).text());
      var action  = el.data("action");
      performTableAction(table, action, el);
    }
  });

  $("#sequences").on("click", "li", function() {
    $("#tables li.selected").removeClass("selected");
    $("#sequences li.selected").removeClass("selected");

    $(this).addClass("selected");
    $("#tables").attr("data-current", $.trim($(this).text()));

    showTableContent();
    $(".table-information ul").hide();
  });

  $("#refresh_tables").on("click", function() {
    loadTables();
    loadSequences();
  });

  $("#rows_filter").on("submit", function(e) {
    e.preventDefault();
    $(".current-page").data("page", 1);

    var column = $(this).find("select.column").val();
    var filter = $(this).find("select.filter").val();
    var query  = $.trim($(this).find("input").val());

    if (filter && filterOptions[filter].indexOf("DATA") > 0 && query == "") {
      alert("Please specify filter query");
      return
    }

    showTableContent();
  });

  $(".change-limit").on("click", function() {
    var limit = prompt("Please specify a new rows limit", getRowsLimit());

    if (limit && limit >= 1) {
      $(".current-page").data("page", 1);
      setRowsLimit(limit);
      showTableContent();
    }
  });

  $("select.filter").on("change", function(e) {
    var val = $(this).val();

    if (["null", "not_null"].indexOf(val) >= 0) {
      $(".filters input").hide().val("");
    }
    else {
      $(".filters input").show();
    }
  });

  $("button.reset-filters").on("click", function() {
    $(".filters select, .filters input").val("");
    showTableContent();
  });

  $("#pagination .next-page").on("click", function() {
    var current = $(".current-page").data("page");
    var total   = $(".current-page").data("pages");

    if (total > current) {
      $(".current-page").data("page", current + 1);
      showTableContent();

      if (current + 1 == total) {
        $(this).prop("disabled", "disabled");
      }
    }

    if (current > 1) {
      $(".prev-page").prop("disabled", "");
    }
  });

  $("#pagination .prev-page").on("click", function() {
    var current = $(".current-page").data("page");

    if (current > 1) {
      $(".current-page").data("page", current - 1);
      $(".next-page").prop("disabled", "");
      showTableContent();
    }

    if (current == 1) {
      $(this).prop("disabled", "disabled");
    }
  });

  $("#edit_connection").on("click", function() {
    if (connected) {
      $("#close_connection_window").show();
    }

    showConnectionSettings();
  });

  $("#close_connection_window").on("click", function() {
    $("#connection_window").hide();
  });

  $("#connection_url").on("change", function() {
    if ($(this).val().indexOf("localhost") != -1) {
      $("#connection_ssl").val("disable");
    }
  });

  $("#pg_host").on("change", function() {
    var value = $(this).val();

    if (value.indexOf("localhost") != -1 || value.indexOf("127.0.0.1") != -1) {
      $("#connection_ssl").val("disable");
    }
  });

  $(".connection-group-switch button").on("click", function() {
    $(".connection-group-switch button").removeClass("active");
    $(this).addClass("active");

    switch($(this).attr("data")) {
      case "scheme":
        $(".connection-scheme-group").show();
        $(".connection-standard-group").hide();
        return;
      case "standard":
        $(".connection-scheme-group").hide();
        $(".connection-standard-group").show();
        $(".connection-ssh-group").hide();
        return;
      case "ssh":
        $(".connection-scheme-group").hide();
        $(".connection-standard-group").show();
        $(".connection-ssh-group").show();
        return;
    }
  });

  $("#connection_bookmarks").on("change", function(e) {
    var name = $.trim($(this).val());

    if (name == "") {
      return;
    }

    item = bookmarks[name];

    // Check if bookmark only has url set
    if (item.url != "") {
      $("#connection_url").val(item.url);
      $("#connection_scheme").click();
      return;
    }

    // Fill in bookmarked connection settings
    $("#pg_host").val(item.host);
    $("#pg_port").val(item.port);
    $("#pg_user").val(item.user);
    $("#pg_password").val(item.password);
    $("#pg_db").val(item.database);
    $("#connection_ssl").val(item.ssl);
  });

  $("#connection_form").on("submit", function(e) {
    e.preventDefault();

    var button = $(this).children("button");
    var url = getConnectionString();

    if (url.length == 0) {
      return;
    }

    $("#connection_error").hide();
    button.prop("disabled", true).text("Please wait...");

    apiCall("post", "/connect", { url: url }, function(resp) {
      button.prop("disabled", false).text("Connect");

      if (resp.error) {
        connected = false;
        $("#connection_error").text(resp.error).show();
      }
      else {
        connected = true;
        loadTables();
        loadSequences();

        $("#connection_window").hide();
        $("#current_database").text(resp.current_database);
        $("#main").show();
      }
    });
  });

  initEditor();
  addShortcutTooltips();

  apiCall("get", "/connection", {}, function(resp) {
    if (resp.error) {
      connected = false;
      showConnectionSettings();
    }
    else {
      connected = true;
      loadTables();
      loadSequences();

      $("#current_database").text(resp.current_database);
      $("#main").show();
    }
  });
});
