/* eslint-disable */
/**
 * @author kovacsv / http://kovacsv.hu/
 * @author mrdoob / http://mrdoob.com/
 *
 * modified by Walker
 * 1. Use local matrix rather than world matrix (line 31)
 * 2. Switch y and z (line 65) to handle left-hand and right-hand coordinate problem
 *
 * Update STLExporter function:
   TODO: When exporting with ASCII, it will exceed string max length. Error: Invalid string length
 */

import * as THREE from 'three';

function STLExporter() {};

STLExporter.prototype = {

    constructor: STLExporter,

    parse: (function () {
        return function parse(scene, options){
			if (options === undefined) options = {};

	        const binary = options.binary !== undefined ? options.binary : false;


	        const objects = [];
	        let triangles = 0;

	        scene.traverse((object) => {
	            if (object.isMesh) {
	                const geometry = object.geometry;

	                if (geometry.isBufferGeometry !== true) {
	                    throw new Error('THREE.STLExporter: Geometry is not of type THREE.BufferGeometry.');
	                }

	                const index = geometry.index;
	                const positionAttribute = geometry.getAttribute('position');

	                triangles += (index !== null) ? (index.count / 3) : (positionAttribute.count / 3);

	                objects.push({
	                    object3d: object,
	                    geometry: geometry
	                });
	            }
	        });

	        let output;
	        let offset = 80; // skip header

	        if (binary === true) {
	            const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4;
	            const arrayBuffer = new ArrayBuffer(bufferLength);
	            output = new DataView(arrayBuffer);
	            output.setUint32(offset, triangles, true); offset += 4;
	        } else {
	            output = '';
	            output += 'solid exported\n';
	        }

	        const vA = new THREE.Vector3();
	        const vB = new THREE.Vector3();
	        const vC = new THREE.Vector3();
	        const cb = new THREE.Vector3();
	        const ab = new THREE.Vector3();
	        const normal = new THREE.Vector3();

		    function writeNormal(vAInside, vBInside, vCInside) {
		        cb.subVectors(vCInside, vBInside);
		        ab.subVectors(vAInside, vBInside);
		        cb.cross(ab).normalize();
		        normal.copy(cb).normalize();

		        if (binary === true) {
		            output.setFloat32(offset, normal.x, true); offset += 4;
		            output.setFloat32(offset, normal.y, true); offset += 4;
		            output.setFloat32(offset, normal.z, true); offset += 4;
		        } else {
		            output += `\tfacet normal ${normal.x} ${normal.y} ${normal.z}\n`;
		            output += '\t\touter loop\n';
		        }
		    }

		    function writeVertex(vertex) {
		        if (binary === true) {
		            output.setFloat32(offset, vertex.x, true); offset += 4;
		            output.setFloat32(offset, vertex.y, true); offset += 4;
		            output.setFloat32(offset, vertex.z, true); offset += 4;
		        } else {
		            output += `\t\t\tvertex ${vertex.x} ${vertex.y} ${vertex.z}\n`;
		        }
		    }

		    function writeFace(a, b, c, positionAttribute, object) {
	            vA.fromBufferAttribute(positionAttribute, a);
	            vB.fromBufferAttribute(positionAttribute, b);
	            vC.fromBufferAttribute(positionAttribute, c);

	            if (object.isSkinnedMesh === true) {
	                object.boneTransform(a, vA);
	                object.boneTransform(b, vB);
	                object.boneTransform(c, vC);
	            }

	            vA.applyMatrix4(object.matrixWorld);
	            vB.applyMatrix4(object.matrixWorld);
	            vC.applyMatrix4(object.matrixWorld);

	            writeNormal(vA, vB, vC);

	            writeVertex(vA);
	            writeVertex(vB);
	            writeVertex(vC);

	            if (binary === true) {
	                output.setUint16(offset, 0, true); offset += 2;
	            } else {
	                output += '\t\tendloop\n';
	                output += '\tendfacet\n';
	            }
	        }

	        for (let i = 0, il = objects.length; i < il; i++) {
	            const object = objects[i].object3d;
	            const geometry = objects[i].geometry;

	            const index = geometry.index;
	            const positionAttribute = geometry.getAttribute('position');

	            if (index !== null) {
	                // indexed geometry

	                for (let j = 0; j < index.count; j += 3) {
	                    const a = index.getX(j + 0);
	                    const b = index.getX(j + 1);
	                    const c = index.getX(j + 2);

	                    writeFace(a, b, c, positionAttribute, object);
	                }
	            } else {
	                // non-indexed geometry
                    const remainder = positionAttribute.count % 3 > 1;
	                for (let j = 0; j < positionAttribute.count-1; j += 3) {
	                    const a = j;
	                    const b = j + 1 <= positionAttribute.count ? j + 1  : positionAttribute.count ;
	                    const c = j + 2 <= positionAttribute.count ? j + 2  : positionAttribute.count ;

	                    writeFace(a, b, c, positionAttribute, object);
	                }
	            }
	        }

	        if (binary === false) {
	            output += 'endsolid exported\n';
	        }

	        return output;
		}
    }())

};

export default STLExporter;
