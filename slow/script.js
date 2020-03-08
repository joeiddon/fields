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

gl.enableVertexAttribArray(a_position_loc);

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.enableVertexAttribArray(a_position_loc);
gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);

function draw_lines(lines) {
    // Lines should be an array of shape (n, 2).
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines.flat()), gl.STATIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, lines.length);
}

let step = 0.04;

function fit_canvas_to_screen(){
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
fit_canvas_to_screen();
window.addEventListener('resize', fit_canvas_to_screen);

function update(c) {
    let k = 0.003;

    let lines = [];
    for (let y = -1; y <= 1; y += step)
        for (let x = -1; x <= 1; x += step) {
            if (Math.abs(x - c[0]) +  Math.abs(y - c[1]) < 0.2) continue;
            let r = [x - c[0], y - c[1]];
            let d = (r[0] ** 2 + r[1] ** 2) ** 0.5;
            let n = r.map(c => c / d);
            let E = n.map(c => - k * c / (d ** 2));
            lines.push([x, y]);
            lines.push([x + E[0], y + E[1]]);
            //lines.push([x + E[0], y + E[1]]);
            //lines.push([x + E[0], y + E[1] - 0.01]);
        }
    draw_lines(lines);
}

function toclipspace(c) {
    return [
        (c[0] / canvas.width) * 2 - 1,
        -((c[1] / canvas.height) * 2 - 1),
    ];
}

update([0, 0]);

canvas.addEventListener('mousemove', e => update(toclipspace([e.x, e.y])));
