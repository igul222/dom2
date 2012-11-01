// since this is supposed to be a self-contained bookmarkelet, including jquery is a little trickier than usual.
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
		Physijs.scripts.worker = 'physijs_worker.js';
		Physijs.scripts.ammo = 'ammo.js';
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
        camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 );
		/*controls = new THREE.FirstPersonControls(camera);
        controls.movementSpeed = 1000;
        controls.lookSpeed = 0.1;/**/
		
        camera.position.z = 300;

        scene = new Physijs.Scene;

        var objects = get3DPageObjects();

		//LOLOL ADDDDEDEDDD STYFFFF__________________________==============================$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
		//document.addEventListener( 'mousemove', onMouseMove, false );
		
		// create a sphere shape        
		geometry = new THREE.SphereGeometry( 16, 16, 16 );

		// give a shape red color
		material = new THREE.MeshLambertMaterial({color: 0xFF1111});    

		// create an object
		mesh = new THREE.Mesh( geometry, material );

		mesh.position.x = 100;
		mesh.position.y = -100;
		mesh.position.z = 100;

		// add it to the scene
		scene.add( mesh );
		
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
		
		//$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
		
		// Ground
		ground_material = Physijs.createMaterial(
			new THREE.MeshLambertMaterial({ map: THREE.ImageUtils.loadTexture( 'images/rocks.jpg' ) }),
			.8, // high friction
			.3 // low restitution
		);
		ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
		ground_material.map.repeat.set( 3, 3 );
		
		ground = new Physijs.BoxMesh(
			new THREE.CubeGeometry(100, 100, 1),
			ground_material,
			0 // mass
		);
		ground.receiveShadow = true;
		scene.add( ground );
		
		spawnBox();
		
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
            //threejs_animate();

          }
        });
		//setInterval(update,1000/30); 
		
		//physijs init stuff
		/*$('body').append('<div id="viewport"></div>');
		render_stats = new Stats();
		render_stats.domElement.style.position = 'absolute';
		render_stats.domElement.style.top = '0px';
		render_stats.domElement.style.zIndex = 100;
		document.getElementById( 'viewport' ).appendChild( render_stats.domElement );
		
		physics_stats = new Stats();
		physics_stats.domElement.style.position = 'absolute';
		physics_stats.domElement.style.top = '50px';
		physics_stats.domElement.style.zIndex = 100;
		document.getElementById( 'viewport' ).appendChild( physics_stats.domElement );*/

		scene.setGravity(new THREE.Vector3( 0, 0, -30 ));
		scene.addEventListener(
			'update',
			function() {
				scene.simulate( undefined, 1 );
				physics_stats.update();
			}
		);
      }
	  
	  spawnBox = (function() {
		var box_geometry = new THREE.CubeGeometry( 4, 4, 4 ),
			handleCollision = function( collided_with, linearVelocity, angularVelocity ) {
				switch ( ++this.collisions ) {
					
					case 1:
						this.material.color.setHex(0xcc8855);
						break;
					
					case 2:
						this.material.color.setHex(0xbb9955);
						break;
					
					case 3:
						this.material.color.setHex(0xaaaa55);
						break;
					
					case 4:
						this.material.color.setHex(0x99bb55);
						break;
					
					case 5:
						this.material.color.setHex(0x88cc55);
						break;
					
					case 6:
						this.material.color.setHex(0x77dd55);
						break;
				}
			},
			createBox = function() {
				var box, material;
				
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
				box.collisions = 0;
				
				box.position.set(
					Math.random() * 15 - 7.5,
					25,
					Math.random() * 15 - 7.5
				);
				
				box.rotation.set(
					Math.random() * Math.PI,
					Math.random() * Math.PI,
					Math.random() * Math.PI
				);
				
				box.castShadow = true;
				box.addEventListener( 'collision', handleCollision );
				box.addEventListener( 'ready', spawnBox );
				scene.add( box );
			};
		
		return function() {
			setTimeout( createBox, 1000 );
		};
	})();
	  
	  function update() {
	   /*camera.rotation.y -= ( - mouseX - camera.position.x ) * 0.00005;
	   camera.rotation.x += ( mouseY - camera.position.y ) * 0.00005;*/
	   camera.position.x += ( - mouseX - camera.position.x ) * 0.05;
	   camera.position.y += ( mouseY - camera.position.y ) * 0.05;
	   //camera.lookAt( scene.position );
	   mesh.rotation.y -= 0.005;
		}

      function threejs_animate() {
        // note: three.js includes requestAnimationFrame shim
        requestAnimationFrame(threejs_animate);
        //controls.update(clock.getDelta());
        renderer.render(scene, camera);
		// update stats
		//render_stats.update();
      }
	  
	  function onMouseMove( event ) {
		  mouseX = event.clientX - halfWidth;
		  mouseY = event.clientY - halfHeight;
		}

      // if body's background color is transparent, change it to white
      var rgb = $('body').css('background-color');
      rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
      if(rgb[4] === '0')
        $('body').css('background-color','#fff');
		
		var halfWidth = window.innerWidth/2, halfHeight = window.innerHeight/2;

      threejs_init();
    }); // jquery dom ready

  }); // includes
})(); // bookmarklet wrapper