// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
(function(){

  function initDOMBookmarklet() {
    (window.DOMBookmarklet = function() {

      function get3DPageModel() {
        // TODO: implement
      }

    })();
  }

  // the minimum version of jQuery we want
  var v = "1.3.2";

  // check prior inclusion and version
  if (window.jQuery === undefined || window.jQuery.fn.jquery < v) {
    var done = false;
    var script = document.createElement("script");
    script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + v + "/jquery.min.js";
    script.onload = script.onreadystatechange = function(){
      if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;
        initDOMBookmarklet();
      }
    };
    document.getElementsByTagName("head")[0].appendChild(script);
  } else {
    initDOMBookmarklet();
  }

})();