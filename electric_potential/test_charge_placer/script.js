'use strict';

/*
 * Good fundamental resource: https://webglfundamentals.org/
 * Shaders are defined as strings in the `shaders.js` script.
 *
 * Ultimately WebGL is a 2d rasterization (fills pixels from vector graphic)
 * library, but the Graphics Library Shader Language (GLSL) has features
 * that make writing 3d engines easier. This includes things like matrix
 * operations, dot products, and options like CULL_FACE and DEPTH (Z) BUFFER.
 *
 * For good, clear definitions of buffers etc. see:
 * https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
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

let potential_program = misc.create_gl_program(potential_vertex_shader_src, fragment_shader_src);
let charge_program = misc.create_gl_program(charge_vertex_shader_src, fragment_shader_src);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(potential_program, 'a_position');
let u_world_matrix_loc = gl.getUniformLocation(potential_program, 'u_world_matrix');
let u_view_matrix_loc = gl.getUniformLocation(potential_program, 'u_view_matrix');
let u_charges_loc = gl.getUniformLocation(potential_program, 'u_charges');
let u_light_loc = gl.getUniformLocation(potential_program, 'u_light');

let a_charge_position_loc = gl.getAttribLocation(charge_program, 'a_position');
let a_charge_normal_loc = gl.getAttribLocation(charge_program, 'a_normal'); // spelling error ?
let u_charge_world_matrix_loc = gl.getUniformLocation(charge_program, 'u_world_matrix');
let u_charge_view_matrix_loc = gl.getUniformLocation(charge_program, 'u_view_matrix');
let u_charge_light_loc = gl.getUniformLocation(charge_program, 'u_light');
let u_charge_ball_translate_loc = gl.getUniformLocation(charge_program, 'u_ball_translate');

// if any locations are -1, that means they are not being used in the shaders,
// so compiler got rid of them

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_charge_position_loc);
gl.enableVertexAttribArray(a_charge_normal_loc);


let step = parseFloat(window.location.hash.slice(1));
if (!(step > 0)) step = 0.01; //default value for if no hash, so step is NaN
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

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

let ball = [];
let normals = [];

let angle_step = 2 * Math.PI / 16;
let radius = 0.1;

function get_position_on_ball(yaw, pitch) {
    return [
        radius * Math.cos(pitch) * Math.sin(yaw),
        radius * Math.sin(pitch),
        radius * Math.cos(pitch) * Math.cos(yaw)
    ];
};


for (let yaw = 0; yaw < Math.PI * 2; yaw += angle_step) {
    for (let pitch = -Math.PI / 2; pitch < Math.PI / 2; pitch += angle_step) {
        ball.push(...get_position_on_ball(yaw, pitch));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch + angle_step));
        ball.push(...get_position_on_ball(yaw, pitch));
        ball.push(...get_position_on_ball(yaw, pitch + angle_step));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch + angle_step));
        //for (let i = 0; i < 6; i++)
        //normals.push(...get_position_on_ball(yaw + angle_step / 2 , pitch + angle_step / 2));
        // pushing normals for actual corners, on a per-vertex basis!
        normals.push(...(ball.slice(-6 * 3)));
    }
}

let charge_positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, charge_positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ball), gl.STATIC_DRAW);

let charge_normals_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, charge_normals_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

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

//let cam = [0, 1.5, -2]; // issues when cam is up x-axis with panning of space_pitch !!
let cam = [0, 1.5, -2];

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

let light = [-0.5, -1.5, 0.8]; // normalised in vertex shader

let charges = [];
let mouse_charge = {position: [0, 0], magnitude: -0.5};

let matrices = {};

function calculate_matrices(){
    // matrices in right-to-left order (i.e. in order of application)

    // rotates space according to space_yaw and space_pitch
    matrices.rot = m4.multiply(m4.rotation_x(space_pitch), m4.rotation_y(space_yaw));
    //transforms in front of cam's view
    matrices.view = m4.multiply(m4.inverse(m4.orient(cam, [0,0,0])), matrices.rot);
    //maps 3d to 2d
    matrices.world = m4.multiply(m_perspective, matrices.view);
}

function update() {
    calculate_matrices();

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(potential_program);

    gl.uniformMatrix4fv(u_view_matrix_loc, false, m4.gl_format(matrices.rot));
    gl.uniformMatrix4fv(u_world_matrix_loc, false, m4.gl_format(matrices.world));
    gl.uniform3fv(u_light_loc, new Float32Array(light));
    let u_charges_data = [...mouse_charge.position, mouse_charge.magnitude];
    for (let i = 0; i < MAX_CHARGES - 1; i ++){ // -1 because one taken up by mouse
        if (i < charges.length) u_charges_data.push(...charges[i].position, charges[i].magnitude);
        else u_charges_data.push(0, 0, 0);
    }
    gl.uniform3fv(u_charges_loc, new Float32Array(u_charges_data));

    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

    gl.useProgram(charge_program);
    gl.uniform3fv(u_charge_ball_translate_loc, new Float32Array([1, 0.5, 0]));
    gl.uniformMatrix4fv(u_charge_view_matrix_loc, false, m4.gl_format(matrices.rot));
    gl.uniformMatrix4fv(u_charge_world_matrix_loc, false, m4.gl_format(matrices.world));
    gl.uniform3fv(u_charge_light_loc, new Float32Array(light));
    gl.bindBuffer(gl.ARRAY_BUFFER, charge_positions_buffer);
    gl.vertexAttribPointer(a_charge_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, charge_normals_buffer);
    gl.vertexAttribPointer(a_charge_normal_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, ball.length / 3);

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
    } else {
        // move mouse charge
        mouse_charge.position = toclipspace(e.x, e.y);
    }
});

canvas.addEventListener('wheel', e => {mouse_charge.magnitude += e.deltaY / 200});
canvas.addEventListener('click', e => {charges.push({position: [...mouse_charge.position], magnitude: mouse_charge.magnitude})}); // unpacked so creates new object
