// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
(function(){
  var players=[];
  var id;
  var connected;
  var socketcdn="http://cdn.socket.io/stable/socket.io.js";
  var socketsrc="http://localhost:5000/socket.io/socket.io.js";

  function include(url, callback) { 
    if(url instanceof Array) {
      if(url.length == 0) {
        callback();
        return;
      }
      include(url[0], function() {
        include(url.slice(1), callback);
      });
      return;
    }
    var done = false;
    var script = document.createElement("script");
    script.src = url;
    script.onload = script.onreadystatechange = function(){
      if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;
        callback();
      }
    };
    document.getElementsByTagName("head")[0].appendChild(script);
  }

  include(['jquery-1.8.2.min.js','three.min.js','html2canvas.js', socketsrc], function() {
    function get3DPageObjects() {
      var objects = [];
      function recursivelyAddElementToObjects(e, zlevel) {
        var offset = e.offset();
        objects.push({
          x: offset.left, 
          y: offset.top, 
          z: 10+(10*zlevel), 
          width: e.outerWidth(), 
          height: e.outerHeight(), 
          depth: 10
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

      // adds a 3D DOM object to the scene, handling conversions between coordinate systems.
      function addObject(o) {
          var geometry = new THREE.CubeGeometry(o.width,o.height,o.depth);
          var material = new THREE.MeshBasicMaterial( { color: 0xff00ff*Math.random(), wireframe: false } );

          var mesh = new THREE.Mesh( geometry, material );
          mesh.position.x = o.x+(o.width/2);
          mesh.position.y = (-1*o.y)+(o.height/-2);
          mesh.position.z = o.z;
          scene.add(mesh);
      }

      // returns a cropped copy of the given image in callback
      function dataURLWithCroppedImage(srcImage, x, y, width, height, callback) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(srcImage, x, y, width, height, 0, 0, width, height);
        
        return canvas.toDataURL('image/png');
      }

      function threejs_init() {
        camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
        camera.position.z = 500;

        controls = new THREE.FirstPersonControls(camera);
        controls.movementSpeed = 1000;
        controls.lookSpeed = 0.1;
        scene = new THREE.Scene();

        var objects = get3DPageObjects();

        html2canvas( [ $('body')[0] ], {
          onrendered: function( canvas ) {
            var bodyImg = new Image();
            bodyImg.onload = function() {
              // add each 3D DOM object to the scene, handling conversions between coordinate systems.
              function addObjectAtIndex(i) {
                var o = objects[i];

                var gray_material = new THREE.MeshBasicMaterial({color: 0x555555});
                var cropped_url = dataURLWithCroppedImage(bodyImg, o.x, o.y, o.width, o.height);
              
                var croppedImage = new Image();
                croppedImage.src = cropped_url;
                croppedImage.tex = new THREE.Texture(croppedImage);
                croppedImage.tex.needsUpdate = true;
                croppedImage.onload = function() {
                  this.tex.needsUpdate = true;
                }

                var image_material = new THREE.MeshBasicMaterial({color: 0xffffff, map: croppedImage.tex});

                var materials = [gray_material,gray_material,gray_material,gray_material,image_material,gray_material]
                var geometry = new THREE.CubeGeometry(o.width,o.height,o.depth,1,1,1,materials);

                var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial() );
                mesh.position.x = o.x+(o.width/2);
                mesh.position.y = (-1*o.y)+(o.height/-2);
                mesh.position.z = o.z;
                scene.add(mesh);
              
              }

              for(var i in objects)
                addObjectAtIndex(i);

            }
            bodyImg.src = canvas.toDataURL("image/png");

            renderer = new THREE.WebGLRenderer();
            renderer.setSize( window.innerWidth, window.innerHeight );

            document.body.appendChild( renderer.domElement );
            $(renderer.domElement).css('position','fixed').css('left','0').css('top','0').css('background-color','#333');
            threejs_animate();

          }
        });
        start();

      }
      // if body's background color is transparent, change it to white
      var rgb = $('body').css('background-color');
      rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
      if(rgb[4] === '0')
        $('body').css('background-color','#fff');

      threejs_init();


      function start(){
        client_connect_to_server();
        
      }

       function client_connect_to_server() {
        
        //Store a local reference to our connection to the server
        this.socket = io.connect("http://localhost:5000");

        //When we connect, we are not 'connected' until we have a server id
        //and are placed in a game by the server. The server sends us a message for that.
        this.socket.on('connect', function(){
            this.state = 'connecting';
        }.bind(this));

            //Sent when we are disconnected (network, server down, etc)
        //this.socket.on('disconnect', this.client_ondisconnect.bind(this));
            //Sent each tick of the server simulation. This is our authoritive update
        this.socket.on('onserverupdate', client_onserverupdate_received.bind(this));
            //Handle when we connect to the server, showing state and storing id's.
        this.socket.on('onconnected', client_onconnected.bind(this));
            //On error we just show that we are not connected for now. Can print the data.
        //this.socket.on('error', this.client_ondisconnect.bind(this));
            //On message from the server, we parse the commands and send it to the handlers
        //this.socket.on('message', this.client_onnetmessage.bind(this));

      }; //client_connect_to_server

      function client_onconnected(data) {
          //The server responded that we are now in a game,
          //this lets us store the information about ourselves and set the colors
          //to show we are now ready to be playing.
          console.log(data);
          this.id = data['id'];
          this.state = 'connected';
          this.online = true;
          players[players.length]=new player(this.id, camera.position.x, camera.position.y, camera.position.z);
      }; //client_onconnected

      function initPlayers(){
        spheres=[];
        for (var i = 0; i < players.length; i++) {
          x=players[i].x;
          y=players[i].y;
          z=players[i].z;

          // Sphere parameters: radius, segments along width, segments along height
          var sphereGeometry = new THREE.SphereGeometry( 50, 32, 16 ); 
          // use a "lambert" material rather than "basic" for realistic lighting.
          //   (don't forget to add (at least one) light!)
          var sphereMaterial = new THREE.MeshLambertMaterial( {color: 0x88ffff} ); 
          sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(x, y, z);
          spheres.push(sphere); 
          scene.add(spheres);
        };
      }
      function sendPosition(p){
        //this.socket.emit('location', {id:p.id, x:p.x, y:p.y, z:p.z});
        socket.emit('location',p) ;
      }
      function threejs_animate() {
        // note: three.js includes requestAnimationFrame shim
        update();
        requestAnimationFrame(threejs_animate);
        controls.update(clock.getDelta);
        renderer.render(scene, camera);
      }

      function update(){
        // delta = change in time since last call (seconds)
        delta = clock.getDelta();
        if(delta>=1){
          for (var i = players.length - 1; i >= 0; i--) {
            sendPosition(players[i]);
          };
          initPlayers();
        }
      }
      function client_onserverupdate_received(data){
        if(data.instanceof(Array)){
          players=data;
          console.log(data);
        }
        else{
          console.log(data+"");
        }
      }

      function player(id,x,y,z){
         this.id=id;
         this.x=x;
         this.y=y;
         this.z=z;
      }


    }); // jquery dom ready

  }); // includes

})(); // bookmarklet wrapper