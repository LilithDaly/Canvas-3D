const canvas = document.createElement("canvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");

// Library for interacting with node server easily.
const socket = io();

// 2 dimensional vector for screen space and texture space textures.
class vec2d {
    constructor(u, v) {
        this.u = u;
        this.v = v;
    }
}

// 3 dimensional vector with a w property used for projecting into 2d screen space.
class vec3d {
    constructor(x, y, z, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}

// Triangle class for holding multiple vectors efficiently and storing basic triangle information.
class tri {
    // The least needed to instanciate this class is the verticies, and should be used as often as possible.
    // Information can be dirived from given points unless specifically designed otherwise.
    // Triange vertices should be given in clockwise order for correct normal mapping.
    constructor(vec1, vec2, vec3, lum = 255, norm = new vec3d(0, 0, 0), avgZ = 0) {
        this.p = [vec1, vec2, vec3];
        this.lum = lum;
        this.norm = norm;
        this.avgZ = avgZ;
    }

    getCopy() {
        return new tri(this.p[0], this.p[1], this.p[2], this.lum, this.norm, this.avgZ);
    }
}

// Mesh class definied as a collection of triangles.
// Should be loaded from file to avoid normal orientation issues.
class mesh {
    constructor(arr = []) {
        this.tris = arr;
    }

    // Load .obj given local path.
    loadFromOBJ(path) {
        // Pass local path to node server using established socket.
        socket.emit("path", path);

        // Temp array of vertices.
        var points = [];

        // Listener for server return of file contents.
        socket.on("data", (e) => {
            // For each line in the file.
            // Data is split using a regex for new line characters.
            e.split(/\r?\n/).forEach((i) => {
                // Test for, and push, vertex data.
                if (i[0] == "v") {
                    points.push(
                        new vec3d(parseFloat(i.split(" ")[1]), parseFloat(i.split(" ")[2]), parseFloat(i.split(" ")[3]))
                    );
                }

                // Test for face data and push new triangle given verticies from points array.
                if (i[0] == "f") {
                    var t = new tri(
                        points[parseFloat(i.split(" ")[1]) - 1],
                        points[parseFloat(i.split(" ")[2]) - 1],
                        points[parseFloat(i.split(" ")[3]) - 1],
                    );

                    this.tris.push(t);
                }
            });
        });
    }
}

// 4x4 matrix class for vector maths, initialized as a 2 dimensional array holding a passed value--typically 0.
class mat4x4 {
    constructor(val) {
        this.m = [[val, val, val, val],
                  [val, val, val, val],
                  [val, val, val, val],
                  [val, val, val, val]];
    }
}

// Camera class for vertex projection in view space.
class camera {
    constructor (fov, near, far) {
        this.fov = fov;
        this.near = near;
        this.far = far;

        // Interpreted variables for cleaner projection matrix.
        this.a = canvas.height / canvas.width;
        this.f = 1 / (Math.tan((fov * (Math.PI / 180)) / 2));
        this.q = this.far / (this.far - this.near);

        this.pos = new vec3d(0, 0, 0);

        this.lookDirection = new vec3d(0, 0, 1);

        this.yaw = 0;
    }
}

// Main function for the sake of my sanity.
main();
function main() {
    function clearScreen() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Vector helper functions, eventually I will go through these and add relevant methods to the `vec3d` class.
    const vector = {
        add: (v1, v2) => {
            return new vec3d(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
        },
        sub: (v1, v2) => {
            return new vec3d(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
        },
        scale: (v, k) => {
            return new vec3d(v.x * k, v.y * k, v.z * k);
        },
        dot: (v1, v2) => {
            return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
        },
        len: (v) => {
            return Math.sqrt(vector.dot(v, v));
        },
        normalize: (v) => {
            var l = vector.len(v);
            return new vec3d(v.x / l, v.y / l, v.z / l);
        },
        cross: (v1, v2) => {
            return new vec3d(
                v1.y * v2.z - v1.z * v2.y,
                v1.z * v2.x - v1.x * v2.z,
                v1.x * v2.y - v1.y * v2.x
            );
        },
        intersectPlane: (pP, pN, lS, lE) => {
            pN = vector.normalize(pN);
            var pD = -vector.dot(pN, pP);
            var ad = vector.dot(lS, pN);
            var bd = vector.dot(lE, pN);
            var t = (-pD - ad) / (bd - ad);
            var lD = vector.sub(lE, lS);
            var toInter = vector.scale(lD, t);

            return vector.add(lS, toInter);
        },
        toScreen: (v) => {
            return new vec3d(
                (v.x + 1) * canvas.width / 2,
                (v.y - 1) * canvas.height / -2,
                v.z,
            )
        },
        toProjected: (p, v) => {
            tmp = matrix.multiplyVec(p, v);

            return new vec3d(
                tmp.x / tmp.w, 
                tmp.y / tmp.w, 
                tmp.z / tmp.w
            );
        }
    };

    // Triangle helper functions, eventually I will go through these and add relevant methods to the `tri` class.
    const triangle = {
        draw: (inTri) => {
            var q = [inTri.getCopy()];

            for (var p = 0; p < 4; p++) {
                var plane;

                switch (p) {
                    case 0:
                        // pos x
                        plane = [ new vec3d(1, 0, 0), new vec3d(-1, 0, 0) ];
                        break;
                    case 1:
                        // pos y
                        plane = [ new vec3d(0, 1, 0), new vec3d(0, -1, 0) ];
                        break;
                    case 2:
                        // neg x
                        plane = [ new vec3d(-1, 0, 0), new vec3d(1, 0, 0) ];
                        break;
                    case 3:
                        // neg y
                        plane = [ new vec3d(0, -1, 0), new vec3d(0, 1, 0) ];
                        break;
                }

                var newT = [];

                q.forEach((t) => {
                    triangle.clipAgainstPlane(plane[0], plane[1], t).forEach((n) => {
                        newT.push(n);
                    });
                });

                q = newT;
            }

            ctx.fillStyle = "rgb(" + inTri.lum + ", " + inTri.lum + ", " + inTri.lum + ")";
            ctx.strokeStyle = "rgb(" + inTri.lum + ", " + inTri.lum + ", " + inTri.lum + ")";

            q.forEach((t) => {
                var point1 = vector.toScreen(t.p[0]);
                var point2 = vector.toScreen(t.p[1]);
                var point3 = vector.toScreen(t.p[2]);

                ctx.beginPath();
                ctx.moveTo(point1.x, point1.y);
                ctx.lineTo(point2.x, point2.y);
                ctx.lineTo(point3.x, point3.y);
                ctx.lineTo(point1.x, point1.y);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            });
        },
        clipAgainstPlane: (pP, pN, inTri) => {
            pN = vector.normalize(pN);

            function dist(p) {
                return (pN.x * p.x + pN.y * p.y + pN.z * p.z - vector.dot(pN, pP));
            } 
    
            var iP = [];
            var oP = [];
    
            var d0 = dist(inTri.p[0]);
            var d1 = dist(inTri.p[1]);
            var d2 = dist(inTri.p[2]);
    
            if (d0 >= 0) {
                iP.push(inTri.p[0]);
            } else {
                oP.push(inTri.p[0]);
            }
    
            if (d1 >= 0) {
                iP.push(inTri.p[1]);
            } else {
                oP.push(inTri.p[1]);
            }
    
            if (d2 >= 0) {
                iP.push(inTri.p[2]);
            } else {
                oP.push(inTri.p[2]);
            }
    
            if (iP.length == 0) {
                return [];
            }
    
            if (iP.length == 3) {
                return [inTri];
            }
    
            if (iP.length == 1 && oP.length == 2) {
                outTri = inTri.getCopy();
    
                outTri.p[0] = iP[0];
                outTri.p[1] = vector.intersectPlane(pP, pN, iP[0], oP[0]);
                outTri.p[2] = vector.intersectPlane(pP, pN, iP[0], oP[1]);
    
                return [outTri];
            }
    
            if (iP.length == 2 && oP.length == 1) {
                outTri1 = inTri.getCopy();
                outTri2 = inTri.getCopy();
    
                outTri1.p[0] = iP[0];
                outTri1.p[1] = iP[1];
                outTri1.p[2] = vector.intersectPlane(pP, pN, iP[0], oP[0]);
    
                outTri2.p[0] = iP[1];
                outTri2.p[1] = outTri1.p[2];
                outTri2.p[2] = vector.intersectPlane(pP, pN, iP[1], oP[0]);
    
                return [outTri1, outTri2];
            }
        },
        project: (p, inTri) => {
            return new tri(
                vector.toProjected(p, inTri.p[0]),
                vector.toProjected(p, inTri.p[1]),
                vector.toProjected(p, inTri.p[2]),
                inTri.lum,
                inTri.norm,
                (inTri.p[0].z + inTri.p[1].z + inTri.p[2].z) / 3,
            );
        }
    }

    // Matrix helper functions, eventually I will go through these and add relevant methods to the `mat4x4` class.
    const matrix = {
        multiplyVec: (m, i) => {
            return new vec3d(
                i.x * m.m[0][0] + i.y * m.m[1][0] + i.z * m.m[2][0] + i.w * m.m[3][0],
                i.x * m.m[0][1] + i.y * m.m[1][1] + i.z * m.m[2][1] + i.w * m.m[3][1],
                i.x * m.m[0][2] + i.y * m.m[1][2] + i.z * m.m[2][2] + i.w * m.m[3][2],
                i.x * m.m[0][3] + i.y * m.m[1][3] + i.z * m.m[2][3] + i.w * m.m[3][3]
            );
        },
        makeIdentity: () => {
            var mat = new mat4x4(0);

            mat.m[0][0] = 1;
            mat.m[1][1] = 1;
            mat.m[2][2] = 1;
            mat.m[3][3] = 1;

            return mat;
        },
        makeRotationX: (theta) => {
            var mat = new mat4x4(0);

            mat.m[0][0] = 1;
            mat.m[1][1] = Math.cos(theta);
            mat.m[1][2] = Math.sin(theta);
            mat.m[2][1] = -Math.sin(theta);
            mat.m[2][2] = Math.cos(theta);
            mat.m[3][3] = 1;

            return mat;
        },
        makeRotationY: (theta) => {
            var mat = new mat4x4(0);

            mat.m[0][0] = Math.cos(theta);
            mat.m[0][2] = Math.sin(theta);
            mat.m[1][1] = 1;
            mat.m[2][0] = -Math.sin(theta);
            mat.m[2][2] = Math.cos(theta);
            mat.m[3][3] = 1;
    
            return mat;
        },
        makeRotationZ: (theta) => {
            var mat = new mat4x4(0);

            mat.m[0][0] = Math.cos(theta);
            mat.m[1][0] = Math.sin(theta);
            mat.m[0][1] = -Math.sin(theta);
            mat.m[1][1] = Math.cos(theta);
            mat.m[2][2] = 1;
            mat.m[3][3] = 1;
    
            return mat;
        },
        makeTranslation: (vec) => {
            var mat = matrix.makeIdentity();

            mat.m[3][0] = vec.x;
            mat.m[3][1] = vec.y;
            mat.m[3][2] = vec.z;
    
            return mat;
        },
        makeProjection: (cam) => {
            var mat = new mat4x4(0);

            mat.m[0][0] = cam.a * cam.f;
            mat.m[1][1] = cam.f;
            mat.m[2][2] = cam.q;
            mat.m[3][2] = -1 * cam.near * cam.q;
            mat.m[2][3] = 1;
    
            return mat;
        },
        multiplyMatrix: (m1, m2) => {
            var mat = new mat4x4(0);

            for (var c = 0; c < 4; c++) {
                for (var r = 0; r < 4; r++) {
                    mat.m[r][c] = m1.m[r][0] * m2.m[0][c] + m1.m[r][1] * m2.m[1][c] + m1.m[r][2] * m2.m[2][c] + m1.m[r][3] * m2.m[3][c];
                }
            }
    
            return mat;
        },
        pointAt: (pos, target, up) => {
            var newForward = vector.sub(target, pos);
            newForward = vector.normalize(newForward);
    
            var a = vector.scale(newForward, vector.dot(up, newForward));
            var newUp = vector.sub(up, a);
            newUp = vector.normalize(newUp);
    
            var newRight = vector.cross(newUp, newForward);
    
            var mat = new mat4x4(0);
            mat.m[0][0] = newRight.x;	mat.m[0][1] = newRight.y;	mat.m[0][2] = newRight.z;	mat.m[0][3] = 0;
            mat.m[1][0] = newUp.x;		mat.m[1][1] = newUp.y;		mat.m[1][2] = newUp.z;		mat.m[1][3] = 0;
            mat.m[2][0] = newForward.x;	mat.m[2][1] = newForward.y;	mat.m[2][2] = newForward.z;	mat.m[2][3] = 0;
            mat.m[3][0] = pos.x;		mat.m[3][1] = pos.y;		mat.m[3][2] = pos.z;	    mat.m[3][3] = 1;
            
            return mat;
        },
        quickInverse: (m) => {
            var mat = new mat4x4(0);

            mat.m[0][0] = m.m[0][0]; mat.m[0][1] = m.m[1][0]; mat.m[0][2] = m.m[2][0]; mat.m[0][3] = 0;
            mat.m[1][0] = m.m[0][1]; mat.m[1][1] = m.m[1][1]; mat.m[1][2] = m.m[2][1]; mat.m[1][3] = 0;
            mat.m[2][0] = m.m[0][2]; mat.m[2][1] = m.m[1][2]; mat.m[2][2] = m.m[2][2]; mat.m[2][3] = 0;
            mat.m[3][0] = -(m.m[3][0] * mat.m[0][0] + m.m[3][1] * mat.m[1][0] + m.m[3][2] * mat.m[2][0]);
            mat.m[3][1] = -(m.m[3][0] * mat.m[0][1] + m.m[3][1] * mat.m[1][1] + m.m[3][2] * mat.m[2][1]);
            mat.m[3][2] = -(m.m[3][0] * mat.m[0][2] + m.m[3][1] * mat.m[1][2] + m.m[3][2] * mat.m[2][2]);
            mat.m[3][3] = 1;

            return mat;
        }
    }

    var keys = {};

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    var mainCam = new camera(70, 0.1, 1000);

    var lightDirection = new vec3d(-1, 1, -1);
    lightDirection = vector.normalize(lightDirection);

    // Projection matrix using the `mainCam`
    var projectionMat = matrix.makeProjection(mainCam);

    let start;

    var monkey = new mesh();
    monkey.loadFromOBJ("monke.obj");

    var meshes = [];
    meshes.push(monkey);

    function loop(timestamp) {
        clearScreen();

        if (start == undefined) {
            start = 0;
        }

        if (timestamp == undefined) {
            timestamp = 0;
        }

        const fTheta = (timestamp - start) / 1000;

        if (keys["ArrowUp"]) {
            mainCam.pos.y += 0.05;
        }

        if (keys["ArrowDown"]) {
            mainCam.pos.y -= 0.05;
        }

        if (keys["ArrowLeft"]) {
            mainCam.pos.x -= 0.05;
        }

        if (keys["ArrowRight"]) {
            mainCam.pos.x += 0.05;
        }

        var forV = vector.scale(mainCam.lookDirection, 0.1);

        if (keys["w"]) {
            mainCam.pos = vector.add(mainCam.pos, forV);
        }

        if (keys["s"]) {
            mainCam.pos = vector.sub(mainCam.pos, forV);
        }

        if (keys["a"]) {
            mainCam.yaw += 0.02;
        }

        if (keys["d"]) {
            mainCam.yaw -= 0.02;
        }

        // Rotation Z
        var matRotZ = matrix.makeRotationY(0);

        // Rotation X
        var matRotX = matrix.makeRotationX(0 / 2);

        // Translation
        var matTrans = matrix.makeTranslation(new vec3d(0, 0, 3));

        // World Matrix
        var matWorld = matrix.makeIdentity();
        matWorld = matrix.multiplyMatrix(matRotZ, matRotX);
        matWorld = matrix.multiplyMatrix(matWorld, matTrans);

        var up = new vec3d(0, 1, 0);
        var target = new vec3d(0, 0, 1);
        var matCameraRot = matrix.makeRotationY(mainCam.yaw);
        mainCam.lookDirection = matrix.multiplyVec(matCameraRot, target);
        target = vector.add(mainCam.pos, mainCam.lookDirection);

        var matCamera = matrix.pointAt(mainCam.pos, target, up);

        var matView = matrix.quickInverse(matCamera);

        meshes.forEach((el) => {

            var triArr = [];

            el.tris.forEach((e) => {

                var transformTri = new tri(
                    matrix.multiplyVec(matWorld, e.p[0]),
                    matrix.multiplyVec(matWorld, e.p[1]),
                    matrix.multiplyVec(matWorld, e.p[2]),
                );

                var line1 = vector.sub(transformTri.p[1], transformTri.p[0]);

                var line2 = vector.sub(transformTri.p[2], transformTri.p[0]);

                var normal = vector.cross(line1, line2)
                normal = vector.normalize(normal);

                var vCamRay = vector.sub(transformTri.p[0], mainCam.pos);

                if (vector.dot(normal, vCamRay) < 0) {
                    var luminance = vector.dot(normal, lightDirection);

                    var viewedTri = new tri(
                        matrix.multiplyVec(matView, transformTri.p[0]),
                        matrix.multiplyVec(matView, transformTri.p[1]),
                        matrix.multiplyVec(matView, transformTri.p[2]),
                        (luminance + 1) * 127.5,
                        normal
                    );

                    var clippedTris = triangle.clipAgainstPlane(
                        new vec3d(0, 0, mainCam.near),
                        new vec3d(0, 0, 1),
                        viewedTri,
                    );

                    clippedTris.forEach((t) => {
                        triArr.push(triangle.project(projectionMat, t));
                    });
                }
            });

            triArr.sort((a, b) => {
                return b.avgZ - a.avgZ;
            });

            triArr.forEach((triToRaster) => {
                triangle.draw(triToRaster);
            });
        });

        window.requestAnimationFrame(loop);
    }

    // setTimeout( () => { loop(); }, 500);

    window.requestAnimationFrame(loop);
}