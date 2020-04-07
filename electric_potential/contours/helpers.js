'use strict';

/*
 * Written around 1/8/2019.
 *
 * Tests:
 *  m4.multiply([[1,2,3,4],[5,6,...],...] , [[1,2,3,4],[5,6,...],...])
 *  >>> [[90,100,110,120],[202,228,254,280],[314,356,398,440],[426,484,542,600]]
 */

let misc = {
    create_gl_program: function(vertex_shader_source, fragment_shader_source){
        function create_shader(type, source){
            //uses globally-accessible `gl` context object
            let shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            return shader;
            //debugging info printed to console
            throw new Error('Error when compiling' +
                (type==gl.VERTEX_SHADER?'vertex':'fragment')+'shader.\n\n'+
                gl.getShaderInfoLog(shader));
        }
        let program = gl.createProgram();
        gl.attachShader(program, create_shader(gl.VERTEX_SHADER, vertex_shader_source));
        gl.attachShader(program, create_shader(gl.FRAGMENT_SHADER, fragment_shader_source));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
            throw new Error('Error linking WebGL program.\n\n'+
                getProgramInfoLog(program));
        }
        return program;
    },
    create_texture: function(image_path){
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        //void gl.texImage2D(target, level, internalformat, width, height, border, format, type, ArrayBufferView|HTMLImageElement|...? pixels);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,255,0,255]));
        let img = new Image();
        img.addEventListener('load', function(){
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
        });
        img.src = 'textures/' + image_path;
        return texture;
    },
    deg_to_rad: (d) => d * Math.PI/180,
    rad_to_deg: (r) => r * 180/Math.PI,
    cross: function(a,b){
        //returns the vector product of a and b (a X b)
        //can be proven by using distributivity and then subbing
        //in results for ixi, jxj, kxk etc.(See gphotos for details)
        return [a[1]*b[2]-a[2]*b[1],
                a[2]*b[0]-a[0]*b[2],
                a[0]*b[1]-a[1]*b[0]];
    },
    length: function(v){
        //returns the length of 3d vector v
        return (v[0]**2+v[1]**2+v[2]**2)**0.5
        //any dimension but slower: v.reduce((acc,cur)=>acc+cur**2,0)**0.5;
        //proof: https://jsperf.com/reduce-vs-manual
    },
    norm: function(v){
        //returns the normalised version of the 3d vector v
        let l = misc.length(v);
        return [v[0]/l,v[1]/l,v[2]/l];
        //any dimension but slower: v.map(c=>c/l);
        //proof: https://jsperf.com/map-vs-manuall
    },
    add_vec: function (a,b){
        //returns 3d vector addition: a+b
        return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
    },
    sub_vec: function (a,b){
        //returns 3d vector subtraction: a-b
        return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    },
    scale_vec: function(v,s){
        //returns vector scaled by s
        return v.map(c=>c*s);
    },
    perspective_mat: function(fov, aspect, near, far){
        /*
         * See workings on gphotos for proof of this matrix (different to webglfundamental's, 
         * because our z-axis is positive going away from us).
         * Warning: does not map z uniformly from near<-->far to -near<-->far (and hence -1<-->1)
         * so with n=5,f=7,z=6 =/=> z'=0, but z=6 maps to a lower value than z=6.0001, so main
         * thing is that the mapping preserves *order* for the depth buffer.
         */
        return [
            [ 1/(aspect*Math.tan(fov/2)),                 0,                     0,                     0],
            [                          0, 1/Math.tan(fov/2),                     0,                     0],
            [                          0,                 0, (far+near)/(far-near), 2*near*far/(near-far)],
            [                          0,                 0,                     1,                     0]
        ];
    }
}

let m4 = {
    identity: function(){
        return [
            [ 1, 0, 0, 0],
            [ 0, 1, 0, 0],
            [ 0, 0, 1, 0],
            [ 0, 0, 0, 1]
        ];
    },
    multiply: function(a,b){
        //returns [a*b]
        return a.map((r,ri)=>r.map((_,ci)=>a[ri][0]*b[0][ci]+a[ri][1]*b[1][ci]+a[ri][2]*b[2][ci]+a[ri][3]*b[3][ci]));
        /*
        return [
            [a[0][0]*b[0][0]+a[0][1]*b[1][0]+a[0][2]*b[2][0]+a[0][3]*b[3][0], a[0][0]*b[0][1]+a[0][1]*b[1][1]+a[0][2]*b[2][1]+a[0][3]*b[3][1],
                a[0][0]*b[0][2]+a[0][1]*b[1][2]+a[0][2]*b[2][2]+a[0][3]*b[3][2], a[0][0]*b[0][3]+a[0][1]*b[1][3]+a[0][2]*b[2][3]+a[0][3]*b[3][3]],
            [a[1][0]*b[0][0]+a[1][1]*b[1][0]+a[1][2]*b[2][0]+a[1][3]*b[3][0], a[1][0]*b[0][1]+a[1][1]*b[1][1]+a[1][2]*b[2][1]+a[1][3]*b[3][1],
                a[1][0]*b[0][2]+a[1][1]*b[1][2]+a[1][2]*b[2][2]+a[1][3]*b[3][2], a[1][0]*b[0][3]+a[1][1]*b[1][3]+a[1][2]*b[2][3]+a[1][3]*b[3][3]],
            [a[2][0]*b[0][0]+a[2][1]*b[1][0]+a[2][2]*b[2][0]+a[2][3]*b[3][0], a[2][0]*b[0][1]+a[2][1]*b[1][1]+a[2][2]*b[2][1]+a[2][3]*b[3][1],
                a[2][0]*b[0][2]+a[2][1]*b[1][2]+a[2][2]*b[2][2]+a[2][3]*b[3][2], a[2][0]*b[0][3]+a[2][1]*b[1][3]+a[2][2]*b[2][3]+a[2][3]*b[3][3]],
            [a[3][0]*b[0][0]+a[3][1]*b[1][0]+a[3][2]*b[2][0]+a[3][3]*b[3][0], a[3][0]*b[0][1]+a[3][1]*b[1][1]+a[3][2]*b[2][1]+a[3][3]*b[3][1],
                a[3][0]*b[0][2]+a[3][1]*b[1][2]+a[3][2]*b[2][2]+a[3][3]*b[3][2], a[3][0]*b[0][3]+a[3][1]*b[1][3]+a[3][2]*b[2][3]+a[3][3]*b[3][3]]
        ];
        */
        //see the jsperf.com comparison test: https://jsperf.com/map-efficiency
    },
    translation: function(x,y,z){
        //returns a [4x4] translation matrix that translates by [x,y,z]
        return [
            [ 1, 0, 0, x],
            [ 0, 1, 0, y],
            [ 0, 0, 1, z],
            [ 0, 0, 0, 1]
        ];
    },
    //all rotation functions take an argument in radians and rotate using
    //the left-hand rotation rule: thumb pointing in positive direction of axis,
    //then rotates the way the fingers curl (anti-clockwise looking down the axis)
    rotation_x: function(r){
        let c = Math.cos(r), s = Math.sin(r);
        return [
            [ 1, 0, 0, 0],
            [ 0, c,-s, 0],
            [ 0, s, c, 0],
            [ 0, 0, 0, 1]
        ];
    },
    rotation_y: function(r){
        let c = Math.cos(r), s = Math.sin(r);
        return [
            [ c, 0, s, 0],
            [ 0, 1, 0, 0],
            [-s, 0, c, 0],
            [ 0, 0, 0, 1]
        ];
    },
    rotation_z: function(r){
        let c = Math.cos(r), s = Math.sin(r);
        return [
            [ c,-s, 0, 0],
            [ s, c, 0, 0],
            [ 0, 0, 1, 0],
            [ 0, 0, 0, 1]
        ];
    },
    apply: function(m,v){
        //returns vector after applying tranformation matrix m
        return [
            m[0][0]*v[0]+m[0][1]*v[1]+m[0][2]*v[2]+m[0][3]*v[3],
            m[1][0]*v[0]+m[1][1]*v[1]+m[1][2]*v[2]+m[1][3]*v[3],
            m[2][0]*v[0]+m[2][1]*v[1]+m[2][2]*v[2]+m[2][3]*v[3],
            m[3][0]*v[0]+m[3][1]*v[2]+m[3][2]*v[2]+m[3][3]*v[3]
        ];
    },
    gl_format: function(m){
        //transposes matrix m and then flattens it for WebGL
        return [
            m[0][0], m[1][0], m[2][0], m[3][0],
            m[0][1], m[1][1], m[2][1], m[3][1],
            m[0][2], m[1][2], m[2][2], m[3][2],
            m[0][3], m[1][3], m[2][3], m[3][3]
        ];
    },

    orient: function(pos, look_at, up){
        /*
         * Gives a transformation matrix to move an objectat the origin (facing down the
         * positive z axis) to the coordinate pos and rotate it so it is looking at look_at.
         * See gphotos for workings (mainly a diagram reinforcing the ideas taken from
         * the webglfundamentals guide).
         * All arguments are 3d vectors (no 4th `w` component). Arg `up` defaults to [0,1,0].
         */
        if (!up) up = [0,1,0];
        else up = misc.norm(up);

        let znew = misc.norm(misc.sub_vec(look_at, pos)); // look_at - pos
        let xnew = misc.norm(misc.cross(up, znew));
        let ynew = misc.cross(znew, xnew);
        return [
            [ xnew[0], ynew[0], znew[0], pos[0]],
            [ xnew[1], ynew[1], znew[1], pos[1]],
            [ xnew[2], ynew[2], znew[2], pos[2]],
            [       0,       0,       0,      1]
        ];
    },
    inverse: function(m){
        /*
         * Calculates the 4x4 inverse.
         * Didn't prove method to self as much too long, but that
         * can be seen here: https://semath.info/src/inverse-cofactor-ex4.html
         * And the C# code that I used as a template for this JS
         * implementation of the algorithm was from someone on
         * stackoverflow: https://stackoverflow.com/a/44446912
         */
        let a2323 = m[2][2] * m[3][3] - m[2][3] * m[3][2];
        let a1323 = m[2][1] * m[3][3] - m[2][3] * m[3][1];
        let a1223 = m[2][1] * m[3][2] - m[2][2] * m[3][1];
        let a0323 = m[2][0] * m[3][3] - m[2][3] * m[3][0];
        let a0223 = m[2][0] * m[3][2] - m[2][2] * m[3][0];
        let a0123 = m[2][0] * m[3][1] - m[2][1] * m[3][0];
        let a2313 = m[1][2] * m[3][3] - m[1][3] * m[3][2];
        let a1313 = m[1][1] * m[3][3] - m[1][3] * m[3][1];
        let a1213 = m[1][1] * m[3][2] - m[1][2] * m[3][1];
        let a2312 = m[1][2] * m[2][3] - m[1][3] * m[2][2];
        let a1312 = m[1][1] * m[2][3] - m[1][3] * m[2][1];
        let a1212 = m[1][1] * m[2][2] - m[1][2] * m[2][1];
        let a0313 = m[1][0] * m[3][3] - m[1][3] * m[3][0];
        let a0213 = m[1][0] * m[3][2] - m[1][2] * m[3][0];
        let a0312 = m[1][0] * m[2][3] - m[1][3] * m[2][0];
        let a0212 = m[1][0] * m[2][2] - m[1][2] * m[2][0];
        let a0113 = m[1][0] * m[3][1] - m[1][1] * m[3][0];
        let a0112 = m[1][0] * m[2][1] - m[1][1] * m[2][0];

        let det = m[0][0] * (m[1][1] * a2323 - m[1][2] * a1323 + m[1][3] * a1223) -
                  m[0][1] * (m[1][0] * a2323 - m[1][2] * a0323 + m[1][3] * a0223) +
                  m[0][2] * (m[1][0] * a1323 - m[1][1] * a0323 + m[1][3] * a0123) -
                  m[0][3] * (m[1][0] * a1223 - m[1][1] * a0223 + m[1][2] * a0123);
        if (det == 0) throw new Error('inverse of 4x4 has det=0');
        let d1 = 1 / det;
        return [
            [d1 *   (m[1][1] * a2323 - m[1][2] * a1323 + m[1][3] * a1223),
             d1 * - (m[0][1] * a2323 - m[0][2] * a1323 + m[0][3] * a1223),
             d1 *   (m[0][1] * a2313 - m[0][2] * a1313 + m[0][3] * a1213),
             d1 * - (m[0][1] * a2312 - m[0][2] * a1312 + m[0][3] * a1212)],
            [d1 * - (m[1][0] * a2323 - m[1][2] * a0323 + m[1][3] * a0223),
             d1 *   (m[0][0] * a2323 - m[0][2] * a0323 + m[0][3] * a0223),
             d1 * - (m[0][0] * a2313 - m[0][2] * a0313 + m[0][3] * a0213),
             d1 *   (m[0][0] * a2312 - m[0][2] * a0312 + m[0][3] * a0212)],
            [d1 *   (m[1][0] * a1323 - m[1][1] * a0323 + m[1][3] * a0123),
             d1 * - (m[0][0] * a1323 - m[0][1] * a0323 + m[0][3] * a0123),
             d1 *   (m[0][0] * a1313 - m[0][1] * a0313 + m[0][3] * a0113),
             d1 * - (m[0][0] * a1312 - m[0][1] * a0312 + m[0][3] * a0112)],
            [d1 * - (m[1][0] * a1223 - m[1][1] * a0223 + m[1][2] * a0123),
             d1 *   (m[0][0] * a1223 - m[0][1] * a0223 + m[0][2] * a0123),
             d1 * - (m[0][0] * a1213 - m[0][1] * a0213 + m[0][2] * a0113),
             d1 *   (m[0][0] * a1212 - m[0][1] * a0212 + m[0][2] * a0112)]
        ];
    }
}
