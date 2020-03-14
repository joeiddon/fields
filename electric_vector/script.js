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

let program = misc.create_gl_program(vertex_shader_src, fragment_shader_src);
gl.useProgram(program);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let u_charges_loc = gl.getUniformLocation(program, 'u_charges');

gl.enableVertexAttribArray(a_position_loc);

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

let step = parseFloat(window.location.hash.slice(1));
if (!(step > 0)) step = 0.05; //default value for if no hash, so step is NaN

window.onhashchange = () => window.location.reload();

function fit_canvas_to_screen(){
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
fit_canvas_to_screen();
window.addEventListener('resize', fit_canvas_to_screen);

// Populate position buffer.
let positions = [];
for (let y = -1; y <= 1; y += step)
    for (let x = -1; x <= 1; x += step)
        positions.push(
            x, y, 0,
            x, y, 1
        ); // the z component is indicating vector end of line

gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

let charges = [];
let mouse_charge = [0, 0];

function update() {
    let u_charges_data = [...mouse_charge, 1];
    for (let i = 0; i < MAX_CHARGES - 1; i ++){ // -1 because one taken up by mouse
        if (i < charges.length) u_charges_data.push(...charges[i], 1);
        else u_charges_data.push(0, 0, 0);
    }
    gl.uniform3fv(u_charges_loc, new Float32Array(u_charges_data));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, positions.length / 3);
    requestAnimationFrame(update);
}

update();

function toclipspace(x, y) {
    return [
        (x / canvas.width) * 2 - 1,
        -((y / canvas.height) * 2 - 1),
    ];
}

canvas.addEventListener('mousemove', e => {mouse_charge = toclipspace(e.x, e.y)});
canvas.addEventListener('click', e => {charges.push(toclipspace(e.x, e.y))});
