'use strict';

window.Physijs = (function() {
	var THREE_REVISION = parseInt( THREE.REVISION, 10 ),
		_matrix = new THREE.Matrix4, _is_simulating = false,
		_Physijs = Physijs, // used for noConflict method
		Physijs = {}, // object assigned to window.Physijs
		Eventable, // class to provide simple event methods
		getObjectId, // returns a unique ID for a Physijs mesh object
		getEulerXYZFromQuaternion, getQuatertionFromEuler,
		addObjectChildren,

		_temp1, _temp2,
		_temp_vector3_1 = new THREE.Vector3,
		
		// constants
		MESSAGE_TYPES = {
			WORLDREPORT: 0,
			COLLISIONREPORT: 1
		},
		REPORT_ITEMSIZE = 14;
	
	Physijs.scripts = {};
	
	//////////////////////////////////////////////////////////////////////////
	//									//
	//////////////////////////////////////////////////////////////////////////
	Eventable = function() {
		this._eventListeners = {};
	};
	Eventable.prototype.addEventListener = function( event_name, callback ) {
		if ( !this._eventListeners.hasOwnProperty( event_name ) ) {
			this._eventListeners[event_name] = [];
		}
		this._eventListeners[event_name].push( callback );
	};
	Eventable.prototype.removeEventListener = function( event_name, callback ) {
		var index;
		
		if ( !this._eventListeners.hasOwnProperty( event_name ) ) return false;
		
		if ( (index = this._eventListeners[event_name].indexOf( callback )) >= 0 ) {
			this._eventListeners[event_name].splice( index, 1 );
			return true;
		}
		
		return false;
	};
	Eventable.prototype.dispatchEvent = function( event_name ) {
		var i,
			parameters = Array.prototype.splice.call( arguments, 1 );
		
		if ( this._eventListeners.hasOwnProperty( event_name ) ) {
			for ( i = 0; i < this._eventListeners[event_name].length; i++ ) {
				this._eventListeners[event_name][i].apply( this, parameters );
			}
		}
	};
	Eventable.make = function( obj ) {
		obj.prototype.addEventListener = Eventable.prototype.addEventListener;
		obj.prototype.removeEventListener = Eventable.prototype.removeEventListener;
		obj.prototype.dispatchEvent = Eventable.prototype.dispatchEvent;
	};
	
	//////////////////////////////////////////////////////////////////////////
	//									//
	//////////////////////////////////////////////////////////////////////////
	getObjectId = (function() {
		var _id = 0;
		return function() {
			return _id++;
		};
	})();
	
	getEulerXYZFromQuaternion = function ( x, y, z, w ) {
		return new THREE.Vector3(
			Math.atan2( 2 * ( x * w - y * z ), ( w * w - x * x - y * y + z * z ) ),
			Math.asin( 2 *  ( x * z + y * w ) ),
			Math.atan2( 2 * ( z * w - x * y ), ( w * w + x * x - y * y - z * z ) )
		);
	};
	
	getQuatertionFromEuler = function( x, y, z ) {
		var c1, s1, c2, s2, c3, s3, c1c2, s1s2;
		c1 = Math.cos( y  ),
		s1 = Math.sin( y  ),
		c2 = Math.cos( -z ),
		s2 = Math.sin( -z ),
		c3 = Math.cos( x  ),
		s3 = Math.sin( x  ),
		
		c1c2 = c1 * c2,
		s1s2 = s1 * s2;
		
		return {
			w: c1c2 * c3  - s1s2 * s3,
		  	x: c1c2 * s3  + s1s2 * c3,
			y: s1 * c2 * c3 + c1 * s2 * s3,
			z: c1 * s2 * c3 - s1 * c2 * s3
		};
	};

	// Physijs.noConflict
	Physijs.noConflict = function() {
		window.Physijs = _Physijs;
		return Physijs;
	};
	//////////////////////////////////////////////////////////////////////////
	//		Physijs.xScene						//
	//////////////////////////////////////////////////////////////////////////
	
	Physijs.xScene	= function(params){
		Eventable.call( this );

		this._worker = new Worker( Physijs.scripts.worker || 'physijs_worker.js' );
		this._materials = {};
		this._objects = {};
		
		this._worker.onmessage	= this._onMessage.bind(this);

		params = params || {};
		params.ammo = Physijs.scripts.ammo || 'ammo.js';
		this.execute( 'init', params );
	};
	Eventable.make( Physijs.xScene );
	Physijs.xScene.prototype.execute	= function( cmd, params ) {
		this._worker.postMessage({ cmd: cmd, params: params });
	};
	
	Physijs.xScene.prototype._onMessage	= function( event ) {
		//console.assert( this instanceof Physijs.Scene )
		var _temp;
		if ( event.data instanceof Float32Array ) {			
			// transferable object
			switch ( event.data[0] ) {
				case MESSAGE_TYPES.WORLDREPORT:
					this._updateScene( event.data );
					break;	
				case MESSAGE_TYPES.COLLISIONREPORT:
					this._updateCollisions( event.data );
					break;
			}
		} else {
			// non-transferable object
			switch ( event.data.cmd ) {
				case 'objectReady':
					_temp = event.data.params;
					if ( this._objects[ _temp ].readyCallback ) {
						this._objects[ _temp ].readyCallback( this._objects[ _temp ] );
					}
					break;	
				default:
					// Do nothing, just show the message
					console.debug('Received: ' + event.data.cmd);
					console.dir(event.data.params);
					break;
			}
		}
	};
	Physijs.xScene.prototype._updateScene = function( data ) {
		var num_objects = data[1],
			object,
			i, offset;
			
		for ( i = 0; i < num_objects; i++ ) {
			
			offset = 2 + i * REPORT_ITEMSIZE;
			object = this._objects[ data[ offset ] ];
			
			if ( object.__dirtyPosition === false ) {
				object.position.set(
					data[ offset + 1 ],
					data[ offset + 2 ],
					data[ offset + 3 ]
				);
			}
			
			if ( object.__dirtyRotation === false ) {
				if ( object.useQuaternion ) {
					object.quaternion.set(
						data[ offset + 4 ],
						data[ offset + 5 ],
						data[ offset + 6 ],
						data[ offset + 7 ]
					);
				} else {
					object.rotation = getEulerXYZFromQuaternion(
						data[ offset + 4 ],
						data[ offset + 5 ],
						data[ offset + 6 ],
						data[ offset + 7 ]
					);
				};
			}
			
			object._physijs.linearVelocity.set(
				data[ offset + 8 ],
				data[ offset + 9 ],
				data[ offset + 10 ]
			);
			
			object._physijs.angularVelocity.set(
				data[ offset + 11 ],
				data[ offset + 12 ],
				data[ offset + 13 ]
			);
			
		}
		
		if ( this._worker.webkitPostMessage ) {
			// Give the typed array back to the worker
			this._worker.webkitPostMessage( data, [data.buffer] );
		}
		
		_is_simulating = false;
		this.dispatchEvent( 'update' );
	};
	Physijs.xScene.prototype._updateCollisions = function( data ) {
		/**
		 * #TODO
		 * This is probably the worst way ever to handle collisions. The inherent evilness is a residual
		 * effect from the previous version's evilness which mutated when switching to transferable objects.
		 *
		 * If you feel inclined to make this better, please do so.
		 */
		 
		var i, j, offset, object, object2,
			collisions = {}, collided_with = [];
		
		// Build collision manifest
		for ( i = 0; i < data[1]; i++ ) {
			offset = 2 + i * 2;
			object = data[ offset ];
			object2 = data[ offset + 1 ];
			
			if ( !collisions[ object ] ) collisions[ object ] = [];
			collisions[ object ].push( object2 );
		}
		
		// Deal with collisions
		for ( object in this._objects ) {
			if ( !this._objects.hasOwnProperty( object ) ) return;
			object = this._objects[ object ];
			if( object instanceof Physijs.Mesh === false )	object	= object._xMesh;
			
			if ( collisions[ object._physijs.id ] ) {
				
				// this object is touching others
				collided_with.length = 0;
				
				for ( j = 0; j < collisions[ object._physijs.id ].length; j++ ) {
					object2 = this._objects[ collisions[ object._physijs.id ][j] ];
					if( object2 instanceof Physijs.Mesh === false )	object2	= object2._xMesh;
					
					if ( object._physijs.touches.indexOf( object2._physijs.id ) === -1 ) {
						object._physijs.touches.push( object2._physijs.id );

						_temp_vector3_1.sub( object.getLinearVelocity(), object2.getLinearVelocity() );
						_temp1 = _temp_vector3_1.length();
						
						_temp_vector3_1.sub( object.getAngularVelocity(), object2.getAngularVelocity() );
						_temp2 = _temp_vector3_1.length();							
						
						object.dispatchEvent( 'collision', object2, _temp1, _temp2 );
						object2.dispatchEvent( 'collision', object, _temp1, _temp2 );
					}
					
					collided_with.push( object2._physijs.id );
				}
				for ( j = 0; j < object._physijs.touches.length; j++ ) {
					if ( collided_with.indexOf( object._physijs.touches[j] ) === -1 ) {
						object._physijs.touches.splice( j--, 1 );
					}
				}
				
			} else {
				
				// not touching other objects
				object._physijs.touches.length = 0;
				
			}
			
		}
		
		if ( this._worker.webkitPostMessage ) {
			// Give the typed array back to the worker
			this._worker.webkitPostMessage( data, [data.buffer] );
		}
	};
	Physijs.xScene.prototype.simulate = function( timeStep, maxSubSteps ) {
		var object_id, object, update;
		
		if ( _is_simulating ) {
			return false;
		}
		
		_is_simulating = true;
		
		for ( object_id in this._objects ) {
			if ( !this._objects.hasOwnProperty( object_id ) ) continue;
			
			object = this._objects[object_id];
			
			if ( object.__dirtyPosition || object.__dirtyRotation ) {
				update = { id: object._physijs.id };
				
				if ( object.__dirtyPosition ) {
					update.pos = { x: object.position.x, y: object.position.y, z: object.position.z };
					object.__dirtyPosition = false;
				}
				
				if ( object.__dirtyRotation ) {
					if (!object.useQuaternion) {
						_matrix.identity().setRotationFromEuler( object.rotation );
						object.quaternion.setFromRotationMatrix( _matrix );
					};
					update.quat = { x: object.quaternion.x, y: object.quaternion.y, z: object.quaternion.z, w: object.quaternion.w };
					object.__dirtyRotation = false;
				}
				
				this.execute( 'updateTransform', update );
			};
		}
		
		this.execute( 'simulate', { timeStep: timeStep, maxSubSteps: maxSubSteps } );
		
		return true;
	};
	Physijs.xScene.prototype.remove = function( object ) {
		if ( object._physijs ) {
			this.execute( 'removeObject', { id: object._physijs.id } );
		}
	};
	Physijs.xScene.prototype.setGravity = function( gravity ) {
		if ( gravity ) {
			this.execute( 'setGravity', gravity );
		}
	};

	addObjectChildren = function( parent, object, offset ) {
		var i;
		
		if ( parent !== object ) {
			offset.x += object.position.x;
			offset.y += object.position.y;
			offset.z += object.position.z;
		}
		
		for ( i = 0; i < object.children.length; i++ ) {
			if ( object.children[i]._physijs ) {
				object.children[i]._physijs.offset = {
					x: object.children[i].position.x + offset.x,
					y: object.children[i].position.y + offset.y,
					z: object.children[i].position.z + offset.z
				};
				
				if ( object.children[i].useQuaternion !== true ) {
					object.children[i].quaternion.copy(getQuatertionFromEuler( object.children[i].rotation.x, object.children[i].rotation.y, object.children[i].rotation.z ));
				}
				object.children[i]._physijs.rotation = {
					x: object.children[i].quaternion.x,
					y: object.children[i].quaternion.y,
					z: object.children[i].quaternion.z,
					w: object.children[i].quaternion.w
				};
				
				parent._physijs.children.push( object.children[i]._physijs );
			}
			
			addObjectChildren( parent, object.children[i], offset.clone() );
		}
	};
	
	Physijs.xScene.prototype.add = function( object, callback ) {
		if ( object._physijs ) {
			object.__dirtyPosition = false;
			object.__dirtyRotation = false;
			this._objects[object._physijs.id] = object;
			
			if ( object.children.length ) {
				object._physijs.children = [];
				addObjectChildren( object, object, new THREE.Vector3 );
			}
			
			object.world 		= this;
			object._xMesh._scene	= this;
			
			if ( callback !== undefined ) {
				object.readyCallback = callback;
			}
			
			if ( object.material._physijs ) {
				if ( !this._materials.hasOwnProperty( object.material._physijs.id ) ) {
					this.execute( 'registerMaterial', object.material._physijs );
					object._physijs.materialId = object.material._physijs.id;
				}
			}
			
			// Object starting position + rotation		
			object._physijs.position = { x: object.position.x, y: object.position.y, z: object.position.z };	
			if (!object.useQuaternion) {
				_matrix.identity().setRotationFromEuler( object.rotation );
				object.quaternion.setFromRotationMatrix( _matrix );
			};
			object._physijs.rotation = { x: object.quaternion.x, y: object.quaternion.y, z: object.quaternion.z, w: object.quaternion.w };
			
			this.execute( 'addObject', object._physijs );
		}
	};

	//////////////////////////////////////////////////////////////////////////
	//		Physijs.Scene						//
	//////////////////////////////////////////////////////////////////////////
	
	// Physijs.Scene
	Physijs.Scene = function( params ) {
		var self = this;
		
		Eventable.call( this );
		THREE.Scene.call( this );
		
		console.assert(this._xScene === undefined)
		this._xScene	= new Physijs.xScene(params);
		this._worker	= this._xScene._worker;
		this._materials = this._xScene._materials;
		this._objects	= this._xScene._objects;

		this._worker.onmessage	= this._xScene._onMessage.bind(this);
		this._updateScene	= this._xScene._updateScene.bind(this);
		this._updateCollisions	= this._xScene._updateCollisions.bind(this);
		this.execute		= this._xScene.execute.bind(this);
		this.simulate		= this._xScene.simulate.bind(this);
	};
	Physijs.Scene.prototype = new THREE.Scene;
	Physijs.Scene.prototype.constructor = Physijs.Scene;
	Eventable.make( Physijs.Scene );
	
	Physijs.Scene.prototype._updateScene		= null;
	Physijs.Scene.prototype._updateCollisions	= null;
	Physijs.Scene.prototype.simulate		= null;
	
	
	Physijs.Scene.prototype.add = function( object, callback ) {
		THREE.Mesh.prototype.add.call( this, object );		
		this._xScene.add(object, callback);
	};
	
	Physijs.Scene.prototype.remove = function( object ) {
		THREE.Mesh.prototype.remove.call( this, object );		
		this._xScene.remove(object);
	};
	
	Physijs.Scene.prototype.setGravity = function( gravity ) {
		this._xScene.setGravity(gravity);
	};
	


	//////////////////////////////////////////////////////////////////////////
	//		Physijs.createMaterial					//
	//////////////////////////////////////////////////////////////////////////

	Physijs.xMaterial	= function(material, friction, restitution){
		console.assert(material instanceof THREE.Material)
		console.assert(material.id)

		this._physijs = {
			id: material.id,
			friction: friction === undefined ? .8 : friction,
			restitution: restitution === undefined ? .2 : restitution
		};
	};	
		
	// Physijs.createMaterial
	Physijs.createMaterial = function( material, friction, restitution ) {
		var physijs_material = function(){};
		physijs_material.prototype = material;
		physijs_material = new physijs_material;
		
		console.assert(physijs_material._physijs === undefined)
		physijs_material._xMaterial	= new Physijs.xMaterial(material, friction, restitution)
		physijs_material._physijs	= physijs_material._xMaterial._physijs;

		return physijs_material;
	};
		

	//////////////////////////////////////////////////////////////////////////
	//		Phsijs.Mesh						//
	//////////////////////////////////////////////////////////////////////////

	Physijs.xMesh	= function(geometry, mass){

		Eventable.call( this );

		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}
		
		this._physijs = {
			type: null,
			id: getObjectId(),
			mass: mass || 0,
			touches: [],
			linearVelocity: new THREE.Vector3,
			angularVelocity: new THREE.Vector3
		};
	}
	Eventable.make( Physijs.xMesh );

	// TODO jme- is that needed
	Physijs.xMesh.prototype.back = function(value){
		if( value === undefined )	return this._back;
		this._back	= value;
		return this;
	};

	Physijs.xMesh.prototype.execute	= function( cmd, params ) {
		if( !this._scene )	return;
		this._scene.execute(cmd, params);
	};
	// Physijs.Mesh.mass
	Physijs.xMesh.prototype.__defineGetter__('mass', function() {
		return this._physijs.mass;
	});
	Physijs.xMesh.prototype.__defineSetter__('mass', function( mass ) {
		console.log("setMass", mass, this._physijs.mass)
		this._physijs.mass = mass;
		this.execute( 'updateMass', { id: this._physijs.id, mass: mass } );
	});

	// Physijs.xMesh.applyImpulse
	Physijs.xMesh.prototype.applyImpulse = function ( force, offset ) {
		this.execute( 'applyImpulse', { id: this._physijs.id, impulse_x: force.x, impulse_y: force.y, impulse_z: force.z, x: offset.x, y: offset.y, z: offset.z } );
	};
	
	// Physijs.Mesh.getAngularVelocity
	Physijs.xMesh.prototype.getAngularVelocity = function () {
		return this._physijs.angularVelocity;
	};
	
	// Physijs.Mesh.setAngularVelocity
	Physijs.xMesh.prototype.setAngularVelocity = function ( velocity ) {
		this.execute( 'setAngularVelocity', { id: this._physijs.id, x: velocity.x, y: velocity.y, z: velocity.z } );
	};
	
	// Physijs.Mesh.getLinearVelocity
	Physijs.xMesh.prototype.getLinearVelocity = function () {
		return this._physijs.linearVelocity;
	};
	
	
	
	// Physijs.Mesh.setLinearVelocity
	Physijs.xMesh.prototype.setLinearVelocity = function ( velocity ) {
		this.execute( 'setLinearVelocity', { id: this._physijs.id, x: velocity.x, y: velocity.y, z: velocity.z } );
	};

	Physijs.xMesh.prototype._boxGeometryInit	= function(geometry, mass){
		console.assert(geometry instanceof THREE.CubeGeometry);
		//console.log("geometry", geometry)
		
		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}
		
		var width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
		var height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
		var depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;
		
		this._physijs.type = 'box';
		this._physijs.width = width;
		this._physijs.height = height;
		this._physijs.depth = depth;
		this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
	}
	
	Physijs.xMesh.prototype._sphereGeometryInit	= function(geometry, mass){
		console.assert(geometry instanceof THREE.SphereGeometry);
		//console.log("geometry", geometry)
		
		if ( !geometry.boundingSphere ) {
			geometry.computeBoundingSphere();
		}
		
		this._physijs.type = 'sphere';
		this._physijs.radius = geometry.boundingSphere.radius;
		this._physijs.mass = (typeof mass === 'undefined') ? (4/3) * Math.PI * Math.pow(this._physijs.radius, 3) : mass;
	};


	Physijs.xMesh.prototype._planeGeometryInit	= function(geometry, mass){
		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}

		var width	= geometry.boundingBox.max.x - geometry.boundingBox.min.x;
		var height	= geometry.boundingBox.max.y - geometry.boundingBox.min.y;

		this._physijs.type = 'plane';
		this._physijs.normal = {
			x	: this._physijs.normal.x,
			y	: this._physijs.normal.y,
			z	: this._physijs.normal.z
		};		
		this._physijs.mass = (typeof mass === 'undefined') ? width * height : mass;
	};	

	Physijs.xMesh.prototype._cylinderGeometryInit	= function(geometry, mass){
		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}

		var width, height, depth;
		width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
		height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
		depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

		this._physijs.type = 'cylinder';
		this._physijs.width = width;
		this._physijs.height = height;
		this._physijs.depth = depth;
		this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
	};

	Physijs.xMesh.prototype._coneGeometryInit	= function(geometry, mass){
		// TODO @chandlerp those geometries got no match in three.js
		// - same for ConeMesh and ConvexMesh
		// - how to handle that
		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}

		var width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
		var height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

		this._physijs.type = 'cone';
		this._physijs.radius = width / 2;
		this._physijs.height = height;
		this._physijs.mass = (typeof mass === 'undefined') ? width * height : mass;
	}
	
	Physijs.xMesh.prototype._convexGeometryInit	= function(geometry, mass){
		if ( !geometry.boundingBox ) {
			geometry.computeBoundingBox();
		}
		
		var points	= [];
		for( var i = 0; i < geometry.vertices.length; i++ ) {
			if ( THREE_REVISION >= 49 ) {
				points.push({
					x: geometry.vertices[i].x,
					y: geometry.vertices[i].y,
					z: geometry.vertices[i].z
				});
			} else {
				points.push({
					x: geometry.vertices[i].x.position,
					y: geometry.vertices[i].y.position,
					z: geometry.vertices[i].z.position
				});

			}
		}
		
		
		var width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
		var height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
		var depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;
		
		this._physijs.type = 'convex';
		this._physijs.points = points;
		this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
	}

	//////////////////////////////////////////////////////////////////////////
	//									//
	//////////////////////////////////////////////////////////////////////////
	
	// Phsijs.Mesh
	Physijs.Mesh = function ( geometry, material, mass ) {
		var index;
		// jme- what is this ???
		if ( !geometry ) {
			return;
		}
		
		Eventable.call( this );
		THREE.Mesh.call( this, geometry, material );
		
		console.assert(this._xMesh === undefined)
		console.assert(this._physijs === undefined)
		this._xMesh	= new Physijs.xMesh(geometry, mass)
		// TODO later remove this one and port all access
		this._physijs	= this._xMesh._physijs;
	};
	Physijs.Mesh.prototype = new THREE.Mesh;
	Physijs.Mesh.prototype.constructor = Physijs.Mesh;
	Eventable.make( Physijs.Mesh );
	
	// Physijs.Mesh.mass
	Physijs.Mesh.prototype.__defineGetter__('mass', function() {
		return this._xMesh.mass;
	});
	Physijs.Mesh.prototype.__defineSetter__('mass', function( mass ) {
		this._xMesh.mass = mass;
	});
	
	// Physijs.Mesh.applyCentralImpulse
	Physijs.Mesh.prototype.applyCentralImpulse = function ( force ) {
		this._xMesh.execute( 'applyCentralImpulse', { id: this._physijs.id, x: force.x, y: force.y, z: force.z } );
	};
	
	// Physijs.Mesh.applyImpulse
	Physijs.Mesh.prototype.applyImpulse = function ( force, offset ) {
		this._xMesh.execute( 'applyImpulse', { id: this._physijs.id, impulse_x: force.x, impulse_y: force.y, impulse_z: force.z, x: offset.x, y: offset.y, z: offset.z } );
	};
	
	// Physijs.Mesh.applyCentralForce
	Physijs.Mesh.prototype.applyCentralForce = function ( force ) {
		this._xMesh.execute( 'applyCentralForce', { id: this._physijs.id, x: force.x, y: force.y, z: force.z } );
	};
	
	// Physijs.Mesh.applyForce
	Physijs.Mesh.prototype.applyForce = function ( force, offset ) {
		this._xMesh.execute( 'applyForce', { id: this._physijs.id, impulse_x: force.x, impulse_y: force.y, impulse_z: force.z, x: offset.x, y: offset.y, z: offset.z } );
	};
	
	// Physijs.Mesh.getAngularVelocity
	Physijs.Mesh.prototype.getAngularVelocity = function () {
		return this._physijs.angularVelocity;
	};
	
	// Physijs.Mesh.setAngularVelocity
	Physijs.Mesh.prototype.setAngularVelocity = function ( velocity ) {
		this._xMesh.execute( 'setAngularVelocity', { id: this._physijs.id, x: velocity.x, y: velocity.y, z: velocity.z } );
	};
	
	// Physijs.Mesh.getLinearVelocity
	Physijs.Mesh.prototype.getLinearVelocity = function () {
		return this._physijs.linearVelocity;
	};
	
	// Physijs.Mesh.setLinearVelocity
	Physijs.Mesh.prototype.setLinearVelocity = function ( velocity ) {
		this._xMesh.execute( 'setLinearVelocity', { id: this._physijs.id, x: velocity.x, y: velocity.y, z: velocity.z } );
	};
	
	// Physijs.Mesh.setAngularFactor
	Physijs.Mesh.prototype.setAngularFactor = function ( factor ) {
		this._xMesh.execute( 'setAngularFactor', { id: this._physijs.id, x: factor.x, y: factor.y, z: factor.z } );
	};
	
	// Physijs.Mesh.setLinearFactor
	Physijs.Mesh.prototype.setLinearFactor = function ( factor ) {
		this._xMesh.execute( 'setLinearFactor', { id: this._physijs.id, x: factor.x, y: factor.y, z: factor.z } );
	};
	
	// Physijs.Mesh.setCcdMotionThreshold
	Physijs.Mesh.prototype.setCcdMotionThreshold = function ( threshold ) {
		this._xMesh.execute( 'setCcdMotionThreshold', { id: this._physijs.id, threshold: threshold } );
	};
	
	// Physijs.Mesh.setCcdSweptSphereRadius
	Physijs.Mesh.prototype.setCcdSweptSphereRadius = function ( radius ) {
		this._xMesh.execute( 'setCcdSweptSphereRadius', { id: this._physijs.id, radius: radius } );
	};
	
	//////////////////////////////////////////////////////////////////////////
	//									//
	//////////////////////////////////////////////////////////////////////////
	
	// Physijs.PlaneMesh
	Physijs.PlaneMesh = function ( geometry, material, mass ) {

		Physijs.Mesh.call( this, geometry, material, mass );

		this._xMesh._planeGeometryInit(geometry, mass);
	};
	Physijs.PlaneMesh.prototype = new Physijs.Mesh;
	Physijs.PlaneMesh.prototype.constructor = Physijs.PlaneMesh;
	
	
	// Physijs.BoxMesh
	Physijs.BoxMesh = function( geometry, material, mass ) {

		Physijs.Mesh.call( this, geometry, material, mass );
		
		this._xMesh._boxGeometryInit(geometry, mass);
	};
	Physijs.BoxMesh.prototype = new Physijs.Mesh;
	Physijs.BoxMesh.prototype.constructor = Physijs.BoxMesh;
	
	
	// Physijs.SphereMesh
	Physijs.SphereMesh = function( geometry, material, mass ) {

		Physijs.Mesh.call( this, geometry, material, mass );

		this.xMesh._sphereGeometryInit(geometry, mass);	
	};
	Physijs.SphereMesh.prototype = new Physijs.Mesh;
	Physijs.SphereMesh.prototype.constructor = Physijs.SphereMesh;
	
	
	// Physijs.CylinderMesh
	Physijs.CylinderMesh = function( geometry, material, mass ) {
		
		Physijs.Mesh.call( this, geometry, material, mass );
		
		this.xMesh._cylinderGeometryInit(geometry, mass);	
	};
	Physijs.CylinderMesh.prototype = new Physijs.Mesh;
	Physijs.CylinderMesh.prototype.constructor = Physijs.CylinderMesh;
	
	
	// Physijs.ConeMesh
	Physijs.ConeMesh = function( geometry, material, mass ) {
		Physijs.Mesh.call( this, geometry, material, mass );
		
		this.xMesh._coneGeometryInit(geometry, mass);	
	};
	Physijs.ConeMesh.prototype = new Physijs.Mesh;
	Physijs.ConeMesh.prototype.constructor = Physijs.ConeMesh;
	
	
	// Physijs.ConvexMesh
	Physijs.ConvexMesh = function( geometry, material, mass ) {
		Physijs.Mesh.call( this, geometry, material, mass );
		
		this.xMesh._convexGeometryInit(geometry, mass);	
	};
	Physijs.ConvexMesh.prototype = new Physijs.Mesh;
	Physijs.ConvexMesh.prototype.constructor = Physijs.ConvexMesh;	
	
	return Physijs;
})();