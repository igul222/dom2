// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
(function(){

  function initDOMBookmarklet() {
    (window.DOMBookmarklet = function() {

      function get3DPageObjects() {
        var objects = [];

        var recursivelyAddElementToObjects = function(e, zlevel) {
          var offset = e.offset();
          objects.push({
            x: offset.left, 
            y: offset.top, 
            z: zlevel * 20, 
            width: e.width(), 
            height: e.height(), 
            depth: zlevel * 20,
          });
          e.children().each(function() {
            recursivelyAddElementToObjects($(this), zlevel + 1);
          });
        };

        recursivelyAddElementToObjects($('body'), 1);
        return objects;
      }

      $(function() {
        var camera, scene, renderer, controls;
        var clock = new THREE.Clock();

        init();
        animate();

        function init() {
          camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
          camera.position.z = 500;

          controls = new THREE.FirstPersonControls(camera);
          controls.movementSpeed = 1000;
          controls.lookSpeed = 0.1;
          scene = new THREE.Scene();

          var objects = get3DPageObjects();

          for(var i in objects) {
            var o = objects[i];
            
            var geometry = new THREE.CubeGeometry(o.width,o.height,o.depth);
            var material = new THREE.MeshBasicMaterial( { color: 0xff00ff*Math.random(), wireframe: false } );

            var mesh = new THREE.Mesh( geometry, material );
            mesh.position.x = o.x;
            mesh.position.y = o.z;
            mesh.position.z = o.y;
            scene.add(mesh);
          }

          renderer = new THREE.CanvasRenderer();
          renderer.setSize( window.innerWidth, window.innerHeight );

          document.body.appendChild( renderer.domElement );
          $(renderer.domElement).css('position','fixed').css('left','0').css('top','0').css('background-color','#555');
        }

        function animate() {
          // note: three.js includes requestAnimationFrame shim
          requestAnimationFrame(animate);

          controls.update(clock.getDelta());

          renderer.render(scene, camera);
        }


      });

    })();
  }



  function initThreeJS() {
    (window.threeJSInit = function() {

    var done = false;
    var script = document.createElement("script");
    script.src = "three.min.js";
    script.onload = script.onreadystatechange = function(){
      if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;
        initDOMBookmarklet();
      }
    };
    document.getElementsByTagName("head")[0].appendChild(script);

    })();
  }

  // the minimum version of jQuery we want
  var v = "1.8.2";

  // check prior inclusion and version
  if (window.jQuery === undefined || window.jQuery.fn.jquery < v) {
    var done = false;
    var script = document.createElement("script");
    script.src = "http://ajax.googleapis.com/ajax/libs/jquery/" + v + "/jquery.min.js";
    script.onload = script.onreadystatechange = function(){
      if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;

        initThreeJS();
      }
    };
    document.getElementsByTagName("head")[0].appendChild(script);
  } else {
    initThreeJS();
  }

})();