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

let canvas = document.getElementById('canvas');
let gl = canvas.getContext('webgl');
if (!gl) canvas.innerHTML = 'Oh no! WebGL is not supported.';

let program = misc.create_gl_program(vertex_shader_src, fragment_shader_src);
gl.useProgram(program);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let a_charge_pos_loc = gl.getAttribLocation(program, 'a_charge_pos');

gl.enableVertexAttribArray(a_position_loc);

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.enableVertexAttribArray(a_position_loc);
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

let charge_position = [0, 0];

function update() {
    gl.vertexAttrib2fv(a_charge_pos_loc, new Float32Array(charge_position));
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

canvas.addEventListener('mousemove', e => {charge_position = toclipspace(e.x, e.y);});
