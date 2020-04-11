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
let line_program = misc.create_gl_program(line_vertex_shader_src, fragment_shader_src);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let u_world_matrix_loc = gl.getUniformLocation(program, 'u_world_matrix');
let u_charges_loc = gl.getUniformLocation(program, 'u_charges');

let a_line_position_loc = gl.getAttribLocation(line_program, 'a_position');
let u_line_world_matrix_loc = gl.getUniformLocation(line_program, 'u_world_matrix');

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_line_position_loc);

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);

let divisions = 90;
let step = 2 / divisions;

// positions are in charge / grid coordiantes x, y in [-1,1]
// using a sampling method by working up in ints, then dividing to floats
let positions = [];
for (let xx = 0; xx <= divisions; xx ++) {
    for (let yy = 0; yy <= divisions; yy ++) {
        for (let zz = 0; zz <= divisions; zz ++) {
            // conver the integer xx and yy into the appropriate floting ranges
            let x = xx / divisions * 2 - 1;
            let y = yy / divisions * 2 - 1;
            let z = zz / divisions * 2 - 1;
            positions.push(x, y, z);
        }
    }
}

gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

let AXIS_LINE_LENGTH = 1;

let axis_lines = [
    1, 0, 0,
    -1, 0, 0,
    0, 1, 0,
    0, -1, 0,
    0, 0, 1,
    0, 0, -1,

    // adding edges of the cube too
    -1, -1, -1, 1, -1, -1,
    -1, -1, 1, 1, -1, 1,
    -1, 1, -1, 1, 1, -1,
    -1, 1, 1, 1, 1, 1,
    1, -1, -1, 1, -1, 1,
    -1, -1, -1, -1, -1, 1,
    1, 1, -1, 1, 1, 1,
    -1, 1, -1, -1, 1, 1,
    -1, -1, -1, -1, 1, -1,
    -1, -1, 1, -1, 1, 1,
    1, -1, -1, 1, 1, -1,
    1, -1, 1, 1, 1, 1,

].map(x => x * AXIS_LINE_LENGTH);

let axis_lines_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, axis_lines_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axis_lines), gl.STATIC_DRAW);

function perspective_mat(fov, aspect, near, far){
    return [
        [ 1/(aspect*Math.tan(fov/2)),                 0,                     0,                     0],
        [                          0, 1/Math.tan(fov/2),                     0,                     0],
        [                          0,                 0, (far+near)/(far-near), 2*near*far/(near-far)],
        [                          0,                 0,                     1,                     0]
    ];
}

let fov = misc.deg_to_rad(50);
let near = 0.1; //closest z-coordinate to be rendered
let far = 50; //furthest z-coordianted to be rendered
let m_perspective;

function calculate_perspective_matrix() {
    // put in function so can call again on canvas re-size when aspect changes
    let aspect = canvas.width/canvas.height;
    m_perspective = perspective_mat(fov, aspect, near, far);
}
calculate_perspective_matrix();
window.addEventListener('resize', calculate_perspective_matrix);

let cam = [0, 1.5, -3]; // issues when cam is up x-axis with panning of space_pitch !!

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

let charges = [];
let mouse_charge = {position: [0, 0, 0], magnitude: -0.5};

function calc_u_matrix(){
    // matrices in right-to-left order (i.e. in order of application)

    // rotates space according to space_yaw and space_pitch
    let m_rot = m4.multiply(m4.rotation_x(space_pitch), m4.rotation_y(space_yaw));
    //transforms in front of cam's view
    let m_view = m4.multiply(m4.inverse(m4.orient(cam, [0,0,0])), m_rot);
    //maps 3d to 2d
    let m_world = m4.multiply(m_perspective, m_view);
    return m_world;
}

function update() {
    space_yaw += 0.0015;
    let u_matrix = calc_u_matrix();

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniformMatrix4fv(u_world_matrix_loc, false, m4.gl_format(u_matrix));
    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);
    let u_charges_data = [...mouse_charge.position, mouse_charge.magnitude];
    for (let i = 0; i < MAX_CHARGES - 1; i ++){ // -1 because one taken up by mouse
        if (i < charges.length) u_charges_data.push(...charges[i].position, charges[i].magnitude);
        else u_charges_data.push(0, 0, 0, 0);
    }
    gl.uniform4fv(u_charges_loc, new Float32Array(u_charges_data));
    gl.drawArrays(gl.POINTS, 0, positions.length / 3);

    gl.useProgram(line_program);
    gl.uniformMatrix4fv(u_line_world_matrix_loc, false, m4.gl_format(u_matrix));
    gl.bindBuffer(gl.ARRAY_BUFFER, axis_lines_buffer);
    gl.vertexAttribPointer(a_line_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, axis_lines.length / 3);

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
    let sensitivity = 400;
    // if right click held down, so panning
    if (e.buttons & 2) {
        space_yaw -= e.movementX / sensitivity;
        space_pitch -= e.movementY / sensitivity;
        if (space_pitch > Math.PI/2) space_pitch = Math.PI / 2;
        if (space_pitch < -Math.PI/2) space_pitch = -Math.PI / 2;
    } else {
        // move mouse charge
        mouse_charge.position = [...toclipspace(e.x, e.y), 0];
    }
});

canvas.addEventListener('wheel', e => {mouse_charge.magnitude += e.deltaY / 200});
canvas.addEventListener('click', e => {charges.push({position: [...mouse_charge.position], magnitude: mouse_charge.magnitude})}); // unpacked so creates new object
