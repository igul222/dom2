//code snippets borrowed from 
//https://github.com/IceCreamYou/Nemesis/blob/angelhack/main.js
//http://chandlerprall.github.com/Physijs/ the collisions.html example page

// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
var player;
var thing;
(function(){

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

  include(['jquery-1.8.2.min.js','three.min.js','html2canvas.js', 'physi.js', 'stats.js'], function() {
		Physijs.scripts.worker = 'physijs_worker.js';
		Physijs.scripts.ammo = 'ammo.js';
		var integer = 0;
    function get3DPageObjects() {
      var objects = [];
      function recursivelyAddElementToObjects(e, zlevel) {
				console.log(integer++);
        var offset = e.offset();
        objects.push({
          x: offset.left, 
          y: offset.top, 
          z: 10+(10*zlevel), 
          width: e.outerWidth(), 
          height: e.outerHeight(), 
          depth: 10
        });
				//if(integer<120) //a limiter for the number of dom elements
        e.children().each(function() {
          recursivelyAddElementToObjects($(this), zlevel + 1);
        });
      };

      recursivelyAddElementToObjects($('body'), 1);
      return objects;
    }

    $(function() {
      var camera, cameraVector, scene, renderer, controls, input;
      var clock = new THREE.Clock();
			thing = new THREE.Vector3(0,0,1);
			
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
				createBox();
				
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
					console.log(other_object, relative_velocity, relative_rotation);
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
      }

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
			
      function threejs_animate() {
        // note: three.js includes requestAnimationFrame shim
        requestAnimationFrame(threejs_animate);
        //controls.update(clock.getDelta());
        renderer.render(scene, camera);
				scene.simulate();
      }

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
						console.log("cameraVector", cameraVector, input.direction, cameraAngleChange);
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
						console.log("PLAYER JUMP");
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
				power: null,
				direction: null,
				jump: null,
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
			$(window).focus(function() {
				if (controls) controls.freeze = false;
			});
			$(window).blur(function() {
				if (controls) controls.freeze = true;
			});
				
      threejs_init();
		
    }); // jquery dom ready
		
  }); // includes
})(); // bookmarklet wrapper