'use strict';

/*
 * Good fundamental resource: https://webglfundamentals.org/
 * Shaders are defined as strings in the `shaders.js` script.
 *
 * Ultimately WebGL is a 2d rasterization (fills pixels from vector graphic)
 * library, but the Graphics Library Shader Language (GLSL) has features
 * that make writing 3d engines easier. This includes things like matrix
 * operations, dot products, and options like CULL_FACE and DEPTH (Z) BUFFER.
 */

// ensure this matches the vertex shader #define
const MAX_CHARGES = 50;

let canvas = document.getElementById('canvas');
let gl = canvas.getContext('webgl');
if (!gl) canvas.innerHTML = 'Oh no! WebGL is not supported.';

function fit_canvas_to_screen(){
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
fit_canvas_to_screen();
window.addEventListener('resize', fit_canvas_to_screen);

let program = misc.create_gl_program(vertex_shader_src, fragment_shader_src);
gl.useProgram(program);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let u_matrix_loc = gl.getUniformLocation(program, 'u_matrix');
let u_charges_loc = gl.getUniformLocation(program, 'u_charges');

gl.enableVertexAttribArray(a_position_loc);

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);

let step = parseFloat(window.location.hash.slice(1));
if (!(step > 0)) step = 0.005; //default value for if no hash, so step is NaN
window.onhashchange = () => window.location.reload();

// positions are in charge / grid coordiantes x, y in [0,1]
let positions = [];
// the 1 - step/2 is to avoid floating point comparison errors
for (let y = -1; y < 1 - step / 2; y += step)
    for (let x = -1; x < 1 - step / 2; x += step)
        positions.push(
                 x, y,
            x+step, y,
            x+step, y+step,
                 x, y,
            x+step, y+step,
                 x, y+step
        );

gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

//clockwise triangles are back-facing, counter-clockwise are front-facing
//switch two verticies to easily flip direction a triangle is facing
//"cull face" feature means kill (don't render) back-facing triangles
//gl.enable(gl.CULL_FACE);

//enable the z-buffer (only drawn if z component LESS than that already there)
gl.enable(gl.DEPTH_TEST);

function perspective_mat(fov, aspect, near, far){
    return [
        [ 1/(aspect*Math.tan(fov/2)),                 0,                     0,                     0],
        [                          0, 1/Math.tan(fov/2),                     0,                     0],
        [                          0,                 0, (far+near)/(far-near), 2*near*far/(near-far)],
        [                          0,                 0,                     1,                     0]
    ];
}

let fov = misc.deg_to_rad(60);
let aspect = canvas.width/canvas.height;
let near = 0.1; //closest z-coordinate to be rendered
let far = 50; //furthest z-coordianted to be rendered
let perspective = perspective_mat(fov, aspect, near, far);

let cam_yaw = 0;
let cam_pitch = -0.5;
let cam_dist = 2.5;

function calc_cam_pos(){
    let base = Math.cos(cam_pitch) * cam_dist;
    return [
        Math.cos(cam_yaw) * base,
        -Math.sin(cam_pitch) * cam_dist,
        Math.sin(cam_yaw) * base
    ]
}

let charges = [];
let mouse_charge = [0, 0];

function set_u_matrix(){
    let matrix = m4.identity();
    matrix = m4.multiply(m4.inverse(m4.orient(calc_cam_pos(), [0, 0, 0])), matrix);
    matrix = m4.multiply(perspective, matrix);
    gl.uniformMatrix4fv(u_matrix_loc, false, m4.gl_format(matrix));
}

function update() {
    set_u_matrix();
    let u_charges_data = [...mouse_charge, 1];
    for (let i = 0; i < MAX_CHARGES - 1; i ++){ // -1 because one taken up by mouse
        if (i < charges.length) u_charges_data.push(...charges[i], 1);
        else u_charges_data.push(0, 0, 0);
    }
    gl.uniform3fv(u_charges_loc, new Float32Array(u_charges_data));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
    requestAnimationFrame(update);
}

update();

function toclipspace(x, y) {
    return [
        (x / canvas.width) * 2 - 1,
        -((y / canvas.height) * 2 - 1),
    ];
}

canvas.addEventListener('mousemove', function(e) {
    let sensitivity = 1000;
    // if middle click held down, so panning
    if (e.buttons == 2) {
        cam_yaw -= e.movementX / sensitivity;
        cam_pitch -= e.movementY / sensitivity;
    } else {
        // move mouse charge
        mouse_charge = toclipspace(e.x, e.y);
    }
});
canvas.addEventListener('click', e => {charges.push(toclipspace(e.x, e.y))});
