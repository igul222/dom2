//code snippets borrowed from 
//https://github.com/IceCreamYou/Nemesis/blob/angelhack/main.js
//http://chandlerprall.github.com/Physijs/ the collisions.html example page

// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
var player, camera;
(function(){

	var players = {};
  var id;
  var connected;
  var base="http://domserver.herokuapp.com/public/javascripts/";
  var socketsrc="http://domserver.herokuapp.com/socket.io/socket.io.js";
	var prevPosition;
	var frameCount = 0;

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

  include([base+'jquery-1.8.2.min.js',base+'three.min.js',base+'html2canvas.js', base+'physi.js', base+'stats.js', socketsrc], function() {
		Physijs.scripts.worker = 'physijs_worker.js';
		Physijs.scripts.ammo = 'ammo.js';
		var numberOfDomElements = 0;
    function get3DPageObjects() {
      var objects = [];
      function recursivelyAddElementToObjects(e, zlevel) {
				numberOfDomElements++;
        var offset = e.offset();
        objects.push({
          x: offset.left, 
          y: offset.top, 
          z: 10+(10*zlevel), 
          width: e.outerWidth(), 
          height: e.outerHeight(), 
          depth: 10
        });
				//if(numberOfDomElements<120) //a limiter for the number of dom elements
        e.children().each(function() {
          recursivelyAddElementToObjects($(this), zlevel + 1);
        });
      };

      recursivelyAddElementToObjects($('body'), 1);
      return objects;
    }

    $(function() {
      var cameraVector, scene, renderer, controls, input;
      var clock = new THREE.Clock();
			
			var MOVESPEED = 5000,
					LOOKSPEED = 0.1,
					WIDTH = window.innerWidth,
					HEIGHT = window.innerHeight,
					CAMERADISTANCE = 100,
					ROTATESPEED = Math.PI / 32,
					YAXIS = new THREE.Vector3(0, 1, 0);
					
			cameraVector = new THREE.Vector3(1, 0, 0);

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
        scene = new Physijs.Scene();
				scene.setGravity(new THREE.Vector3( 0, -300, 0 ));
				scene.addEventListener(
					'update',
					function() {
						playerControls();					
						scene.simulate( undefined, 1 );
						physics_stats.update();
					}
				);
				
				//camera
        camera = new THREE.PerspectiveCamera( 75, WIDTH / HEIGHT, 1, 10000 );
				camera.position.y = 500;
        /*controls = new THREE.FirstPersonControls(camera);
        controls.movementSpeed = MOVESPEED;
        controls.lookSpeed = LOOKSPEED;
				controls.noFly = true;*/
				scene.add(camera);
				
				//Random Block
				for(var i = 0; i < 10; i++)
				//createBox();
				
				//Player Block
				var player_material  = new THREE.MeshBasicMaterial({color: 0xcdecde});
				var player_material2 = new THREE.MeshBasicMaterial({color: 0x555555});
				var materials = [player_material2,player_material,player_material,player_material,player_material,player_material]
				var player_physijs_material = Physijs.createMaterial(
					player_material,
					.2, // medium friction
					.3 // low restitution
				);
				player = new Physijs.BoxMesh (
					new THREE.CubeGeometry(10, 10, 10),
					player_physijs_material, 5
				);
				player.position.set(400, 500, 300);				
				player.castShadow = true;
				//box.addEventListener( 'collision', handleCollision );
				//box.addEventListener( 'ready', spawnBox );
				player.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation ) {
					//console.log(other_object, relative_velocity, relative_rotation);
					// `this` has collided with `other_object` with an impact speed of `relative_velocity` and a rotational force of `relative_rotation`
				});
				scene.add( player );
				
				// Input commands
				player.FORWARDS = "forwards";
				player.BACKWARDS = "backwards"
				player.LEFT = "left";
				player.RIGHT = "right";
				player.FIRE = "fire";
				player.SUICIDE = "suicide";
				player.WALK = "walk";
				player.DAMAGE = "damage";
				player.MAXSPEED = 50;
				player.ROTATIONSPEED = 5;
				
				// Light
				light = new THREE.DirectionalLight( 0xFFFFFF );
				light.position.set( 20, 40, -15 );
				light.target.position.copy( scene.position );
				light.castShadow = true;
				light.shadowCameraLeft = -60;
				light.shadowCameraTop = -60;
				light.shadowCameraRight = 60;
				light.shadowCameraBottom = 60;
				light.shadowCameraNear = 20;
				light.shadowCameraFar = 200;
				light.shadowBias = -.0001
				light.shadowMapWidth = light.shadowMapHeight = 2048;
				light.shadowDarkness = .7;
				scene.add( light );
				
				// Ground
				/*ground_material = Physijs.createMaterial(
					new THREE.MeshLambertMaterial({ map: THREE.ImageUtils.loadTexture( 'images/rocks.jpg' ) }),
					.8, // high friction
					.3 // low restitution
				);
				ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
				ground_material.map.repeat.set( 3, 3 );
				
				ground = new Physijs.BoxMesh(
					new THREE.CubeGeometry(100, 1, 100),
					ground_material,
					0 // mass
				);
				ground.receiveShadow = true;
				scene.add( ground );*/
				
				// 3D DOM
				//add dom elements to the parent mesh, then add the parent at the end.
				var parent = new Physijs.BoxMesh( new THREE.CubeGeometry( 1, 1, 1 ), new THREE.MeshBasicMaterial({ color: 0x888888 }), 0 );
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

                var materials = [gray_material,gray_material,image_material,gray_material,gray_material,gray_material]
                var geometry = new THREE.CubeGeometry(o.width,o.depth,o.height,1,1,1,materials);

                var mesh = new Physijs.BoxMesh( geometry, new THREE.MeshFaceMaterial() );
                mesh.position.x = o.x+(o.width/2);
                mesh.position.y = o.z;
                mesh.position.z = -((-1*o.y)+(o.height/-2)); //switching y and z axis
                parent.add(mesh);
              
              }

              for(var i in objects)
                addObjectAtIndex(i);
							scene.add(parent);

            }
            bodyImg.src = canvas.toDataURL("image/png");

            renderer = new THREE.WebGLRenderer({antialias: true});
            renderer.setSize( WIDTH, HEIGHT );

            document.body.appendChild( renderer.domElement );
            $(renderer.domElement).css('position','fixed').css('left','0').css('top','0').css('background-color','#333');
						
						//stats box
						render_stats = new Stats();
						render_stats.domElement.style.position = 'absolute';
						render_stats.domElement.style.top = '0px';
						render_stats.domElement.style.zIndex = 100;
						document.getElementsByTagName('body')[0].appendChild( render_stats.domElement );
						
						physics_stats = new Stats();
						physics_stats.domElement.style.position = 'absolute';
						physics_stats.domElement.style.top = '50px';
						physics_stats.domElement.style.zIndex = 100;
						document.getElementsByTagName('body')[0].appendChild( physics_stats.domElement );
						
            threejs_animate();

          }
        });
				start(); //initialize multiplayer functionality
      }

			//Create a small wooden box near the position (400, 500, 300)
			createBox = function() {
				var box, material;
				var box_geometry = new THREE.CubeGeometry( 4, 4, 4 ),
				
				material = Physijs.createMaterial(
					new THREE.MeshLambertMaterial({ map: THREE.ImageUtils.loadTexture( 'images/plywood.jpg' ) }),
					.6, // medium friction
					.3 // low restitution
				);
				material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping;
				material.map.repeat.set( .5, .5 );
				
				//material = new THREE.MeshLambertMaterial({ map: THREE.ImageUtils.loadTexture( 'images/rocks.jpg' ) });
				
				box = new Physijs.BoxMesh(
					box_geometry,
					material
				);
				//box.collisions = 0;
				
				box.position.set(
					Math.random() * 15 + 400, //x
					Math.random() * 15 + 500, //y
					Math.random() * 15 + 300 //z
				);
				
				box.rotation.set(
					Math.random() * Math.PI,
					Math.random() * Math.PI,
					Math.random() * Math.PI
				);
				
				box.castShadow = true;
				//box.addEventListener( 'collision', handleCollision );
				//box.addEventListener( 'ready', spawnBox );
				scene.add( box );
			};
			
			var  forwards_force_vector = new THREE.Vector3(5000, 0, 0);
			var backwards_force_vector = new THREE.Vector3(-5000, 0, 0);
			var player_force_vector = new THREE.Vector3(0,0,0);
			function playerControls() {
				var rotation_matrix, player_force_vector;
				
				rotation_matrix = new THREE.Matrix4();
				rotation_matrix.extractRotation(player.matrix);
				
				if ( input && player ) {
					//player turning
					var angle;
					if ( input.direction !== 0 ) {
						cameraAngleChange = input.direction * ROTATESPEED;
						//console.log("cameraVector", cameraVector, input.direction, cameraAngleChange);
						var matrix = new THREE.Matrix4().makeRotationAxis( YAXIS, cameraAngleChange );
						matrix.multiplyVector3( cameraVector );
					}
					
					player_force_vector = cameraVector.clone();

					//player movement
					var pV = player.getLinearVelocity();
					if ( input.power !== 0 ) {
						player_force_vector.multiplyScalar(input.power * MOVESPEED);
					} else {
						player_force_vector = player.getLinearVelocity().multiplyScalar(-220);//new THREE.Vector3(0, 0, 0);
						//player.setLinearVelocity(0);
					}
					player_force_vector.setY(0);
					player.applyCentralForce(player_force_vector);
					
					/*if (Math.sqrt(pV.x*pV.x + pV.z*pV.z) > player.MAXSPEED) {
						player_force_vector.divideScalar(100);
						console.log("HEYYYYYYYY");
					}*/
					
					if (input.jump === true ) {
						//console.log("PLAYER JUMP");
						player.applyCentralForce(new THREE.Vector3(0, 5e3, 0))
					} else {
						//nojump
					}
					player.__dirtyPosition = true;
					
					if ( player ) { //camera follow player
					//camera.position.copy( player.position ).addSelf( new THREE.Vector3( 40, 25, 40 ) );
					camera.position.copy( player.position ).addSelf(cameraVector.clone().multiplyScalar(-40).setY(25));
					camera.lookAt( player.position );
				}
				}
			}
			
			//controls
			input = {
				power: 0,
				direction: 0,
				jump: false,
				steering: 0
			};
			document.addEventListener('keydown', function( ev ) {
				switch ( ev.keyCode ) {
					case 37: // left
						input.direction = 1;
						break;

					case 38: // forward
						input.power = 1;
						break;

					case 39: // right
						input.direction = -1;
						break;

					case 40: // back
						input.power = -1;
						break;
						
					case 32: //space
						input.jump = true;
						break;
				}
			});
			
			document.addEventListener('keyup', function( ev ) {
				switch ( ev.keyCode ) {
					case 37: case 39: // left //right
						input.direction = 0;
						break;

					case 38: case 40: // forward
						input.power = 0;
						break;
						
					case 32: //space
						input.jump = false;
						break;
				}
			});
			
      // if body's background color is transparent, change it to white
      var rgb = $('body').css('background-color');
      rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
      if(rgb[4] === '0')
        $('body').css('background-color','#fff');
			
			// Handle window resizing
			$(window).resize(function() {
				WIDTH = window.innerWidth;
				HEIGHT = window.innerHeight;
				ASPECT = WIDTH / HEIGHT;
				if (camera) {
					camera.aspect = ASPECT;
					camera.updateProjectionMatrix();
				}
				if (renderer) {
					renderer.setSize(WIDTH, HEIGHT);
				}
				//$('#intro, #hurt').css({width: WIDTH, height: HEIGHT,});
			});
			
			// Stop moving around when the window is unfocused
			/*$(window).focus(function() {
				if (controls) controls.freeze = false;
			});
			$(window).blur(function() {
				if (controls) controls.freeze = true;
			});*/
				
      threejs_init();
			
			function threejs_animate() {
        // note: three.js includes requestAnimationFrame shim
        requestAnimationFrame(threejs_animate);
        //controls.update(clock.getDelta());
        renderer.render(scene, camera);
				scene.simulate();
				
				client_sendPosition();
      }
			
			//Multiplayer functionality ----------------------------------------------------------
			function start(){
        client_connect_to_server();
        
      }

       function client_connect_to_server() {
        
        //Store a local reference to our connection to the server
        this.socket = io.connect("http://domserver.herokuapp.com");

        //When we connect, we are not 'connected' until we have a server id
        //and are placed in a game by the server. The server sends us a message for that.
        this.socket.on('connect', function(){
            this.state = 'connecting';
        }.bind(this));

            //Sent when we are disconnected (network, server down, etc)
        //this.socket.on('disconnect', this.client_ondisconnect.bind(this));
            //Sent each tick of the server simulation. This is our authoritive update
        this.socket.on('onplayermovement', client_onplayermovement.bind(this));
            //Handle when we connect to the server, showing state and storing id's.
        this.socket.on('onconnected', client_onconnected.bind(this));
            //On error we just show that we are not connected for now. Can print the data.
        //this.socket.on('error', this.client_ondisconnect.bind(this));
            //On message from the server, we parse the commands and send it to the handlers
        //this.socket.on('message', this.client_onnetmessage.bind(this));
						//Sent when a new player connects
				this.socket.on('onnewconnection', client_onnewconnection.bind(this));
						//Sent when a player disconnects
				this.socket.on('ondisconnection', client_ondisconnection.bind(this));
      }; //client_connect_to_server

      function client_onconnected(data) {
          //The server responded that we are now in a game,
          //this lets us store the information about ourselves and set the colors
          //to show we are now ready to be playing.
          console.log("Your client id is: ", data.id);
          this.id = data.id;
          this.state = 'connected';
          this.online = true;
					
					//tell the server our position to verify the connection
					this.socket.emit('verifiedconnection', {x:player.position.x, y:player.position.y, z:player.position.z});
					//store our current position
					prevPosition = player.position.clone();
					
					$.each( data.clients, function (id, client) {
						client_addNewPlayer(id, client.x, client.y, client.z);
						console.log("Existing player: ", id, '(', client.x, client.y, client.z, ')');
					}); 
					
          //players[0] = new networkPlayer(this.id, player.position.x, player.position.y, player.position.z);
      }; //client_onconnected
			
			function client_onnewconnection(playerData) {
				client_addNewPlayer(playerData.id, playerData.x, playerData.y, playerData.z);
				console.log('player ' + playerData.id + ' has connected. Position is ' + playerData.x + ', ' + playerData.y + ',' + playerData.z);
			};
			
			var sphereGeometry = new THREE.SphereGeometry( 10, 32, 16 ); 
			var sphereMaterial = new THREE.MeshLambertMaterial( {color: 0x88ffff} ); 
			function client_addNewPlayer(id, x, y, z) {
				players[id] = new networkPlayer(id, x, y, z);
				//create a sphere
				if (x, y, z) {
						var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
						sphere.position.set( x, y, z );
						scene.add(sphere);
						players[id].model = sphere;
					}
			};
			
			function client_ondisconnection(id) {
					scene.remove(players[id].model);
					delete players[id];
					console.log('player ' + id + ' has disconnected');
					//remove player with the given userid
			};
			
			var spheres;
      function initPlayers(){
				/*if (spheres !== undefined)
					if (spheres.length > 0)
						for (var i = 0; i < spheres.length; i++)
							scene.remove(spheres[i]);
							
        spheres=[];
        for (var i = 0; i < players.length; i++) {
          x=players[i].x;
          y=players[i].y;
          z=players[i].z;

          // Sphere parameters: radius, segments along width, segments along height
          var sphereGeometry = new THREE.SphereGeometry( 10, 32, 16 ); 
          // use a "lambert" material rather than "basic" for realistic lighting.
          //   (don't forget to add (at least one) light!)
          var sphereMaterial = new THREE.MeshLambertMaterial( {color: 0x88ffff} ); 
          sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(x, y, z);
          scene.add(sphere);
          spheres.push(sphere); 
        };*/
      }
      function client_sendPosition(p){
			//check only when connected to server
				if (this.state === 'connected') {
					//check only once every other frame
					if (frameCount++ >= 2) {
						frameCount = 0;
						//update player position moved more than a particular threshold (expensive operation!)
						if (prevPosition.clone().subSelf(player.position).length() > 5) {
							prevPosition = player.position.clone();
							//tell the server our new position and id
							this.socket.emit('updatePosition', {id: this.id, x:player.position.x, y:player.position.y, z:player.position.z});
						}
					}
				}
			}
			
      function client_onplayermovement(data){
				players[data.id].model.position.set( data.x, data.y, data.z );
				//console.log(data.id + ' moved to ' + data.x + ', '+ data.y + ', ' + data.z);
				//initPlayers();
      };
			
      function networkPlayer(id,x,y,z){
         this.id=id;
         this.x=x;
         this.y=y;
         this.z=z;
      };
		
    }); // jquery dom ready
		
  }); // includes
})(); // bookmarklet wrapper